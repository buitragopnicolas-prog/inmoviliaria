import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(readFileSync(resolve(root, 'apps/web/lib/' + name + '.json'), 'utf8'));
const mark = read('brand-mark');
const lettering = read('brand-wordmark');
const icons = read('brand-icons');
const out = resolve(root, 'apps/web/public/brand');
mkdirSync(out, { recursive: true });

const svg = (box, content, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>\n`;
const path = (part, fill, x=0, y=0) => `<path fill="${fill}" fill-rule="evenodd" transform="translate(${x} ${y})" d="${part.path}"/>`;
for (const [variant, symbolColor, ruleColor, textColor] of [
  ['dark', mark.accent, mark.accent, mark.inverse],
  ['light', mark.ink, mark.accent, mark.ink],
  ['mono-white', mark.inverse, mark.inverse, mark.inverse],
  ['mono', mark.ink, mark.ink, mark.ink],
]) {
  // Keep the spacing between the three traced bands of the full signature.
  const signature = path(mark.symbol,symbolColor,147,0) + path(mark.skyline,ruleColor,56,385) + path(lettering,textColor,0,485);
  writeFileSync(resolve(out, `logo-${variant}.svg`), svg('0 0 700 524', signature, mark.name));
  writeFileSync(resolve(out, `isotype-${variant}.svg`), svg(mark.symbol.viewBox,path(mark.symbol,symbolColor), 'JB'));
}
const favicon = svg('0 0 440 440', `<rect width="440" height="440" rx="48" fill="${mark.ink}"/><g stroke="${mark.accent}" stroke-width="3">${path(mark.symbol,mark.accent,27,52)}</g>`, 'JB');
writeFileSync(resolve(out,'favicon.svg'), favicon);
writeFileSync(resolve(root,'apps/web/app/icon.svg'), favicon);
mkdirSync(resolve(out,'icons'), { recursive: true });
for (const [name,icon] of Object.entries(icons)) {
  writeFileSync(resolve(out,'icons',name+'.svg'), svg(icon.viewBox,path(icon,mark.accent),name));
}
