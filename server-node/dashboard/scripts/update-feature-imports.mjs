import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featuresDir = path.join(__dirname, '../src/features');

for (const mod of fs.readdirSync(featuresDir)) {
  const modPath = path.join(featuresDir, mod);
  if (!fs.statSync(modPath).isDirectory()) continue;
  for (const file of fs.readdirSync(modPath)) {
    if (!file.endsWith('Page.jsx')) continue;
    const fp = path.join(modPath, file);
    let c = fs.readFileSync(fp, 'utf8');
    const next = c.replace(
      /import\('\.\.\/\.\.\/pages\/([A-Za-z]+)'\)/g,
      (_, name) => `import('./tabs/${name}Tab')`
    );
    if (next !== c) {
      fs.writeFileSync(fp, next);
      console.log('updated', fp);
    }
  }
}
