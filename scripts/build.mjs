// Copies browser assets next to the TypeScript output: the page, one concatenated stylesheet,
// self-hosted fonts (with their licences) and static icons. No bundler is needed: the browser
// loads the compiled ES modules directly.
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const STYLES = ['tokens', 'base', 'components', 'views', 'market', 'motion'];
const FONTS = [
  ['@fontsource/cormorant-garamond', 'cormorant-garamond-latin-300-normal.woff2'],
  ['@fontsource/cormorant-garamond', 'cormorant-garamond-latin-300-italic.woff2'],
  ['@fontsource/cormorant-garamond', 'cormorant-garamond-latin-500-normal.woff2'],
  ['@fontsource/barlow-condensed', 'barlow-condensed-latin-300-normal.woff2'],
  ['@fontsource/barlow-condensed', 'barlow-condensed-latin-500-normal.woff2'],
  ['@fontsource-variable/inter', 'inter-latin-wght-normal.woff2'],
];

await mkdir('dist/web/fonts', { recursive: true });
await copyFile('src/web/index.html', 'dist/web/index.html');
for (const file of ['icon.svg', 'manifest.webmanifest']) await copyFile(`src/web/static/${file}`, `dist/web/${file}`);
// Exercise photographs (Free Exercise DB, public domain). See docs/ASSETS.md.
await cp('src/web/static/media', 'dist/web/media', { recursive: true });
const css = await Promise.all(STYLES.map(name => readFile(`src/web/styles/${name}.css`, 'utf8')));
await writeFile('dist/web/app.css', css.join('\n'));

const licences = [];
for (const [pkg, file] of FONTS) {
  try {
    await copyFile(`node_modules/${pkg}/files/${file}`, `dist/web/fonts/${file}`);
  } catch {
    console.warn(`Font ${file} is missing. Run npm ci to install it; the app falls back to system fonts.`);
    continue;
  }
  if (!licences.some(entry => entry.pkg === pkg)) licences.push({ pkg, text: await readFile(`node_modules/${pkg}/LICENSE`, 'utf8').catch(() => 'SIL Open Font License 1.1') });
}
await writeFile('dist/web/fonts/LICENSES.txt', licences.map(entry => `${entry.pkg}\n${'='.repeat(entry.pkg.length)}\n${entry.text}`).join('\n\n'));
console.log('Built the Icarus server and browser assets.');
