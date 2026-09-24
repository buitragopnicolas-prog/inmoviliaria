import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mark = JSON.parse(readFileSync(resolve(root, 'apps/web/lib/brand-mark.json'), 'utf8'));
const lettering = JSON.parse(readFileSync(resolve(root, 'apps/web/lib/brand-wordmark.json'), 'utf8'));
const out = resolve(root, 'apps/web/public/brand');
mkdirSync(out, { recursive: true });

const symbol = (ink, accent, foundation = true) => `<g fill="${ink}"><path d="${mark.j}"/><path d="${mark.b}" fill-rule="evenodd"/>${foundation ? `<path d="${mark.foundation}" fill="${accent}"/>` : ''}</g>`;
const svg = (width, height, content, label = mark.name) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>\n`;
const wordmark = (ink) => `<g fill="${ink}"><path d="${lettering.namePath}"/><path d="${lettering.descriptorPath}"/></g>`;

for (const [name, ink, accent] of [
  ['light', mark.ink, mark.accent],
  ['dark', mark.inverse, '#CFB670'],
  ['mono', mark.ink, mark.ink],
  ['mono-white', mark.inverse, mark.inverse],
]) {
  writeFileSync(resolve(out, `isotype-${name}.svg`), svg(96, 96, symbol(ink, accent)));
  writeFileSync(resolve(out, `logo-${name}.svg`), svg(310, 110, `<g transform="translate(6 5)">${symbol(ink, accent)}</g>${wordmark(ink)}`));
}

// A one-colour micro mark keeps the letter counters readable at 16–32 px.
const favicon = svg(96, 96, `<rect width="96" height="96" rx="16" fill="${mark.ink}"/><g transform="translate(3 7) scale(.9)">${symbol(mark.inverse, mark.inverse, false)}</g>`);
writeFileSync(resolve(out, 'favicon.svg'), favicon);
writeFileSync(resolve(root, 'apps/web/app/icon.svg'), favicon);
console.log('Generated 9 brand SVGs and the Next.js app icon from brand-mark.json.');
