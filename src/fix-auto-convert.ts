import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /if \(extractedCurrency !== primaryCurrency\) \{([\s\S]*?finalAmount = await convertCurrency[\s\S]*?)\}/,
  `const autoConvert = profile?.autoConvertCurrency ?? true;
              if (autoConvert && extractedCurrency !== primaryCurrency) {$1}`
);

content = content.replace(
  /if \(currency !== primaryCurrency\) \{([\s\S]*?finalAmount = await convertCurrency[\s\S]*?)\}/,
  `const autoConvert = profile?.autoConvertCurrency ?? true;
      if (autoConvert && currency !== primaryCurrency) {$1}`
);

fs.writeFileSync('src/App.tsx', content);
