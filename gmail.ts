import { auth } from '../frontend/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export interface FetchedEmail {
  id: string;
  subject: string;
  text: string;
  pdfAttachments: string[];
}

export async function fetchRecentReceiptEmails(options?: { frequency?: string, folder?: string, background?: boolean }, onConnected?: () => void): Promise<FetchedEmail[]> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  
  let token = localStorage.getItem('gmailAccessToken');
  const tokenExpiry = localStorage.getItem('gmailTokenExpiry');

  if (!token || !tokenExpiry || new Date().getTime() > parseInt(tokenExpiry)) {
    if (options?.background) {
       throw new Error("INTERACTION_REQUIRED");
    }
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      token = credential?.accessToken || null;
      
      if (!token) {
        throw new Error("Could not get access token");
      }
      
      // Store token for ~55 minutes 
      localStorage.setItem('gmailAccessToken', token);
      localStorage.setItem('gmailTokenExpiry', (new Date().getTime() + 55 * 60 * 1000).toString());

      if (onConnected) {
        onConnected();
      }
    } catch (e) {
      throw e;
    }
  } else {
    // Already connected
    if (onConnected) {
      onConnected();
    }
  }

  try {
    const today = new Date();
    let days = 14;
    if (options?.frequency === 'daily') days = 1;
    else if (options?.frequency === 'weekly') days = 7;
    else if (options?.frequency === 'monthly') days = 30;
    else if (options?.frequency === '3months') days = 90;
    else if (options?.frequency === '6months') days = 180;

    const daysAgo = new Date(today.setDate(today.getDate() - days));
    let queryPurchasesStr = `category:purchases after:${Math.floor(daysAgo.getTime() / 1000)}`;
    let queryOtherStr = `(receipt OR invoice OR "your order" OR payment OR "fatura") -category:purchases after:${Math.floor(daysAgo.getTime() / 1000)}`;

    if (options?.folder) {
      const labels = options.folder.split(',').map(l => l.trim()).filter(l => l);
      if (labels.length > 0) {
        const labelsQuery = `(${labels.map(l => `label:"${l}"`).join(' OR ')})`;
        queryPurchasesStr += ` ${labelsQuery}`;
        queryOtherStr += ` ${labelsQuery}`;
      }
    }

    const queryPurchases = encodeURIComponent(queryPurchasesStr); 
    const queryOther = encodeURIComponent(queryOtherStr); 
    
    // Fetching purchases first
    let allMessages: any[] = [];
    
    let pageTokenPurchases = '';
    let purchasesPages = 0;
    while (purchasesPages < 5) {
      const pageParam = pageTokenPurchases ? `&pageToken=${pageTokenPurchases}` : '';
      const searchResPurchases = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${queryPurchases}&maxResults=500${pageParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (!searchResPurchases.ok) {
          if(searchResPurchases.status === 401) {
              localStorage.removeItem('gmailAccessToken');
              localStorage.removeItem('gmailTokenExpiry');
              throw new Error('Gmail session expired. Please try again.');
          }
          break;
      }
      const searchDataPurchases = await searchResPurchases.json();
      if (searchDataPurchases.messages) {
          allMessages = allMessages.concat(searchDataPurchases.messages);
      }
      if (searchDataPurchases.nextPageToken) {
          pageTokenPurchases = searchDataPurchases.nextPageToken;
          purchasesPages++;
      } else {
          break;
      }
    }

    // Fetching the rest
    let pageTokenOther = '';
    let otherPages = 0;
    while (otherPages < 3) {
      const pageParam = pageTokenOther ? `&pageToken=${pageTokenOther}` : '';
      const searchResOther = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${queryOther}&maxResults=500${pageParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      if (!searchResOther.ok && allMessages.length === 0) {
          if(searchResOther.status === 401) {
              localStorage.removeItem('gmailAccessToken');
              localStorage.removeItem('gmailTokenExpiry');
              throw new Error('Gmail session expired. Please try again.');
          }
          const errText = await searchResOther.text();
          let errMsg = "Failed to fetch messages";
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error?.message) {
              errMsg = parsed.error.message;
            }
          } catch (e) {}
          throw new Error(`Gmail API Error: ${errMsg}. Ensure Gmail API is enabled for this project.`);
      } else if (searchResOther.ok) {
          const searchDataOther = await searchResOther.json();
          if (searchDataOther.messages) {
              const existingIds = new Set(allMessages.map(m => m.id));
              const newM = searchDataOther.messages.filter((m: any) => !existingIds.has(m.id));
              allMessages = allMessages.concat(newM);
          }
          if (searchDataOther.nextPageToken) {
              pageTokenOther = searchDataOther.nextPageToken;
              otherPages++;
          } else {
              break;
          }
      } else {
          break;
      }
    }

    if (allMessages.length === 0) return [];

    const emails = [];
    for (const msg of allMessages) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const msgData = await msgRes.json();
      
      const { subject, text, pdfAttachments } = await extractEmailData(msgData, token!);
      emails.push({ id: msg.id, subject, text, pdfAttachments });
    }
    
    return emails;
  } catch (error) {
    console.error("Error fetching emails:", error);
    throw error;
  }
}

async function extractEmailData(message: any, token: string): Promise<{subject: string, text: string, pdfAttachments: string[]}> {
  let text = '';
  let pdfAttachments: string[] = [];
  
  const headers = message.payload?.headers || [];
  const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
  const date = headers.find((h: any) => h.name === 'Date')?.value || '';
  const from = headers.find((h: any) => h.name === 'From')?.value || '';
  
  text += `From: ${from}\nSubject: ${subject}\nDate: ${date}\n\n`;

  const decodeBase64Url = (str: string) => {
    try {
      return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
    } catch(e) {
      return '';
    }
  };

  const traverseParts = async (parts: any[]) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain') {
        text += decodeBase64Url(part.body?.data || '');
      } else if (part.mimeType === 'application/pdf' && part.body?.attachmentId) {
        if (part.body?.size > 2097152) {
           console.log("PDF attachment too large, skipping");
           continue; 
        }
        // Fetch attachment
        try {
            const attRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}/attachments/${part.body.attachmentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const attData = await attRes.json();
            if (attData.data) {
                // Return URL-safe base64 converted to standard base64
                pdfAttachments.push(attData.data.replace(/-/g, '+').replace(/_/g, '/'));
            }
        } catch(e) {
            console.error("Failed to load attachment", e);
        }
      } else if (part.parts) {
        await traverseParts(part.parts);
      }
    }
  };

  if (message.payload?.parts) {
    await traverseParts(message.payload.parts);
  } else if (message.payload?.body?.data) {
    text += decodeBase64Url(message.payload.body.data);
  }

  // Trim to 4000 characters to fit well in context window for quick processing
  text = text.substring(0, 4000); 
  return { subject, text, pdfAttachments };
}
