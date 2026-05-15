import fs from 'fs';

const content = fs.readFileSync('src/App.tsx', 'utf8');

// We need to import convertCurrency at the top
const importAdded = content.replace(
  'import { formatCurrency } from "./lib/utils";',
  'import { formatCurrency, convertCurrency } from "./lib/utils";'
);

// We need to patch the email sync
let result = importAdded.replace(
  /const extractedCurrency =\s*extracted\.currency \|\| profile\?\.currency \|\| "TRY";\s*const extractedAmount =\s*typeof extracted\.amount === "string"\s*\?\s*parseFloat\(extracted\.amount\)\s*:\s*extracted\.amount;/,
  `const extractedCurrency = extracted.currency || profile?.currency || "TRY";
              let extractedAmount = typeof extracted.amount === "string" ? parseFloat(extracted.amount) : extracted.amount;
              let finalAmount = extractedAmount;
              let finalCurrency = extractedCurrency;
              const primaryCurrency = profile?.currency || "TRY";
              
              if (extractedCurrency !== primaryCurrency) {
                 finalAmount = await convertCurrency(extractedAmount, extractedCurrency, primaryCurrency);
                 finalCurrency = primaryCurrency;
              }`
);

// update the addDoc for email sync
result = result.replace(
`              await addDoc(collection(db, "expenses"), {
                userId: profile?.uid,
                emailId: email.id,
                amount: extractedAmount,
                currency: extractedCurrency,
                merchant: extracted.merchant || "Unknown",`,
`              const expensePayload: any = {
                userId: profile?.uid,
                emailId: email.id,
                amount: finalAmount,
                currency: finalCurrency,
                merchant: extracted.merchant || "Unknown",`
);

result = result.replace(
`                createdAt: serverTimestamp(),
                syncStatus: "pending",
              });`,
`                createdAt: serverTimestamp(),
                syncStatus: "pending",
              };
              if (extractedCurrency !== primaryCurrency && finalCurrency === primaryCurrency) {
                 expensePayload.originalAmount = extractedAmount;
                 expensePayload.originalCurrency = extractedCurrency;
               }
              await addDoc(collection(db, "expenses"), expensePayload);`
);

// Update AddExpenseModal
result = result.replace(
`    try {
      const parsedAmount = parseFloat(formData.amount);
      const expenseData: any = {
        userId,
        merchant: formData.merchant,
        category: formData.category,
        amount: parsedAmount,
        currency,
        date: formData.date,`,
`    try {
      const parsedAmount = parseFloat(formData.amount);
      let finalAmount = parsedAmount;
      let finalCurrency = currency;
      const primaryCurrency = profile?.currency || "TRY";

      if (currency !== primaryCurrency) {
        finalAmount = await convertCurrency(parsedAmount, currency, primaryCurrency);
        finalCurrency = primaryCurrency;
      }

      const expenseData: any = {
        userId,
        merchant: formData.merchant,
        category: formData.category,
        amount: finalAmount,
        currency: finalCurrency,
        date: formData.date,`
);

// we should also add originalAmount and originalCurrency to the manual addition
result = result.replace(
`        date: formData.date,
        description: formData.description,
        isCorporate,
        createdAt: serverTimestamp(),
      };

      if (isRecurring) {`,
`        date: formData.date,
        description: formData.description,
        isCorporate,
        createdAt: serverTimestamp(),
      };
      
      if (currency !== primaryCurrency && finalCurrency === primaryCurrency) {
         expenseData.originalAmount = parsedAmount;
         expenseData.originalCurrency = currency;
      }

      if (isRecurring) {`
);

fs.writeFileSync('src/App.tsx', result);
console.log("Updated App.tsx");
