import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractedExpense {
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  date: string;
  description: string;
  isCorporatePotential: boolean;
}

export async function extractExpenseFromImage(base64Image: string, mimeType: string = "image/jpeg"): Promise<ExtractedExpense> {
  const model = "gemini-2.5-flash";
  
  const prompt = `Analyze this receipt or invoice. Extract the total amount, currency, category, merchant name, date, and a brief description of items. 
  Also, determine if this could potentially be a corporate/business expense (e.g., office supplies, travel, client meal).
  Return the data in the specified JSON format. The extracted text MUST be in Turkish.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amount: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          category: { type: Type.STRING },
          merchant: { type: Type.STRING },
          date: { type: Type.STRING, description: "ISO 8601 format" },
          description: { type: Type.STRING },
          isCorporatePotential: { type: Type.BOOLEAN }
        },
        required: ["amount", "currency", "category", "merchant"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function extractExpenseFromEmail(emailText: string, pdfAttachments: string[], categories: string[]): Promise<ExtractedExpense[]> {
  const model = "gemini-2.5-flash"; // Flash has much higher quota limits
  
  const promptText = `Analyze this email or text receipt, and any attached PDFs. Extract the total amount, currency, category, merchant name, date, and a brief description.
  Determine if this could potentially be a corporate/business expense.
  Important: Choose the best matching category exclusively from this list: ${categories.join(', ')}. If none match well, use 'Other' or the default.
  If the email contains multiple distinct purchases or multiple PDF invoices, you can return a list. If it's a single receipt, return one in an array. If it doesn't look like a valid receipt with an amount, return an empty array.
  Pay close attention to the currency symbol or text (e.g. TL, TRY, $, USD, €, EUR). Always return the standard 3-letter currency code (e.g. TRY, USD, EUR).
  
  Email Content:
  ${emailText}`;

  const parts: any[] = [{ text: promptText }];
  // Only process the first PDF to avoid payload/proxy size limits
  if (pdfAttachments.length > 0) {
    const pdfBase64 = pdfAttachments[0];
    if (pdfBase64 && pdfBase64.length > 10) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: pdfBase64 } });
    }
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            currency: { type: Type.STRING },
            category: { type: Type.STRING },
            merchant: { type: Type.STRING },
            date: { type: Type.STRING, description: "ISO 8601 format (yyyy-MM-dd)" },
            description: { type: Type.STRING },
            isCorporatePotential: { type: Type.BOOLEAN }
          },
          required: ["amount", "currency", "category", "merchant"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
}

export async function generateMonthlyReport(expenses: any[], income: number, isCorporate: boolean) {
  const model = "gemini-2.5-flash";
  
  const prompt = `As a financial assistant, analyze the following monthly expenses for a ${isCorporate ? 'corporate' : 'personal'} user.
  Income: ${income}
  Expenses: ${JSON.stringify(expenses)}
  
  Provide:
  1. A summary of spending habits.
  2. Top 3 categories where they can optimize/save.
  3. Specific advice for ${isCorporate ? 'tax deductions and corporate efficiency' : 'savings and budget management'}.
  4. A motivating closing statement.
  
  Format the response in Markdown. The response MUST be completely in Turkish.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}

export async function getCorporateAdvice(expense: any) {
  const model = "gemini-2.5-flash";
  const prompt = `Analyze this expense for a corporate user: ${JSON.stringify(expense)}.
  Can this be tax deductible? What are the requirements for this type of expense in a corporate context?
  Keep it concise. The response MUST be completely in Turkish.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}
