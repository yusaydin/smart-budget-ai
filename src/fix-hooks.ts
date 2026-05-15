import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const hooksStart = code.indexOf('const [syncingEmails, setSyncingEmails] = useState(false);');
const hooksEnd = code.indexOf(`const activeExpenses = expenses.filter(e => e.syncStatus !== 'pending');`);

if (hooksStart === -1 || hooksEnd === -1) {
    console.error("Hooks block not found");
    process.exit(1);
}

const hooksBlockRaw = code.substring(hooksStart, hooksEnd);

// Strip out the old block
let newCode = code.substring(0, hooksStart) + code.substring(hooksEnd);

// Insert the hooks block right before `if (loading) return <LoadingScreen />;`
const loadingStart = newCode.indexOf('if (loading) return <LoadingScreen />;');

if (loadingStart === -1) {
    console.error("loading block not found");
    process.exit(1);
}

// Add an effect to reset hasAutoSynced
const hooksBlock = hooksBlockRaw + `
  useEffect(() => {
    if (!profile) {
      setHasAutoSynced(false);
    }
  }, [profile]);
`;

newCode = newCode.substring(0, loadingStart) + hooksBlock + '\n  ' + newCode.substring(loadingStart);

fs.writeFileSync('src/App.tsx', newCode);
console.log("Hooks fixed.");
