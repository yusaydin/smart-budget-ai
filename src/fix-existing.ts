import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const effectCode = `  const convertingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile || profile.autoConvertCurrency === false) return;
    
    const convertOldExpenses = async () => {
      const primaryCurrency = profile.currency || "TRY";
      
      const toConvert = expenses.filter(e => e.currency !== primaryCurrency && !convertingRef.current.has(e.id));
      
      if (toConvert.length === 0) return;

      for (const expense of toConvert) {
        convertingRef.current.add(expense.id);
        try {
          const newAmount = await convertCurrency(expense.amount, expense.currency, primaryCurrency);
          await updateDoc(doc(db, "expenses", expense.id), {
            amount: newAmount,
            currency: primaryCurrency,
            originalAmount: expense.amount,
            originalCurrency: expense.currency
          });
        } catch (e) {
          console.error("Failed to convert old expense", e);
          convertingRef.current.delete(expense.id);
        }
      }
    };

    convertOldExpenses();
  }, [profile, expenses]);

  const [loading, setLoading] = useState(true);`;

content = content.replace('  const [loading, setLoading] = useState(true);', effectCode);

fs.writeFileSync('src/App.tsx', content);
