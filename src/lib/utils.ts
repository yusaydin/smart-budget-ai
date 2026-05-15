export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  date?: string
): Promise<number> {
  if (!from || !to || from === to) return amount;
  
  let cleanDate = 'latest';
  if (date) {
    const match = date.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) {
      cleanDate = match[0];
    }
  }

  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();

  try {
    let res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${cleanDate}/v1/currencies/${fromLower}.json`);
    
    // Fallback to latest if the historical date is not found
    if (!res.ok && cleanDate !== 'latest') {
      res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${fromLower}.json`);
    }

    if (res.ok) {
      const data = await res.json();
      if (data[fromLower] && data[fromLower][toLower]) {
        return amount * data[fromLower][toLower];
      } else {
        throw new Error(`Currency ${to} not found in exchange rates for ${fromLower}`);
      }
    } else {
      throw new Error(`Failed to fetch exchange rates: ${res.statusText}`);
    }
  } catch (e: any) {
    console.error("Currency conversion error", e);
    throw e;
  }
}

export function formatCurrency(amount: number, currency: string) {
  try {
    const formatted = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY' }).format(amount);
    // Ensure the currency code is visible to the user explicitly if they have different ones.
    // In tr-TR locale, sometimes it just shows the symbol. We'll add the code if it doesn't already have it.
    if (!formatted.includes(currency)) {
       return `${formatted} ${currency}`;
    }
    return formatted;
  } catch (e) {
    return `${amount.toLocaleString()} ${currency || 'TRY'}`;
  }
}
