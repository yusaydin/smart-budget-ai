export function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY' }).format(amount);
  } catch (e) {
    return `${currency || 'TRY'} ${amount.toLocaleString()}`;
  }
}
