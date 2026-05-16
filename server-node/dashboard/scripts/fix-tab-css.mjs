import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../src');
const pagesDir = path.join(src, 'pages');
const featuresDir = path.join(src, 'features');

function walkTabs(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTabs(p, out);
    else if (ent.name.endsWith('Tab.jsx')) out.push(p);
  }
  return out;
}

for (const tabFile of walkTabs(featuresDir)) {
  const base = path.basename(tabFile, '.jsx');
  const origName = base.replace(/Tab$/, '');
  const pagesCss = path.join(pagesDir, `${origName}.module.css`);
  const tabCss = path.join(path.dirname(tabFile), `${base}.module.css`);

  if (fs.existsSync(pagesCss) && !fs.existsSync(tabCss)) {
    fs.copyFileSync(pagesCss, tabCss);
    console.log('copied css', origName, '->', tabCss);
  }

  if (fs.existsSync(tabFile)) {
    let jsx = fs.readFileSync(tabFile, 'utf8');
    const correct = `./${base}.module.css`;
    const fixed = jsx.replace(
      /import styles from '\.\/[^']+\.module\.css';/,
      `import styles from '${correct}';`
    );
    if (fixed !== jsx) {
      fs.writeFileSync(tabFile, fixed);
      console.log('fixed import', tabFile);
    }
  }
}
