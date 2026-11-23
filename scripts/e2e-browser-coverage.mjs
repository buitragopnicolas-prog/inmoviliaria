import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const web = resolve('apps/web');
const output = join(web, '.next');

// Webpack names the original TypeScript relative to the Next app. Give c8 the
// real location before starting the disposable build. Counts and ranges come
// solely from V8 in the server or the browser.
export async function prepareCoverageMaps() {
  for (const dir of ['server', 'static']) {
    const base = join(output, dir);
    for (const file of await readdir(base, { recursive: true })) {
      if (!file.endsWith('.js.map')) continue;
      const name = join(base, file);
      const map = JSON.parse(await readFile(name, 'utf8'));
      let changed = false;
      map.sources = map.sources.map(source => {
        const relative = /\/\.\/((?:components|app|lib)\/[^?#]+\.[cm]?[jt]sx?)$/.exec(source)?.[1];
        if (!relative || relative.split('/').includes('..') || !existsSync(join(web, relative))) return source;
        changed = true;
        return pathToFileURL(join(web, relative)).href;
      });
      if (changed) await writeFile(name, JSON.stringify(map));
    }
  }
}

export function browserCoverage() {
  const pages = [];
  return {
    async watch(page) {
      if (process.env.JB_TEST_COVERAGE === '1' && process.env.NODE_V8_COVERAGE) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
        pages.push(page);
      }
      return page;
    },
    async save() {
      for (const page of pages) {
        const result = [];
        for (const entry of await page.coverage.stopJSCoverage()) {
          if (!entry.url.startsWith('http://')) continue;
          const url = new URL(entry.url);
          if (!['localhost','127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/_next/static/')) continue;
          const parts = url.pathname.slice('/_next/'.length).split('/').map(decodeURIComponent);
          if (parts.some(part => part === '..' || /[\\/]/.test(part))) continue;
          const file = join(output, ...parts);
          if (!file.endsWith('.js') || entry.source === undefined) continue;
          assert.ok(entry.source === await readFile(file, 'utf8'), 'El código ejecutado debe corresponder a la compilación de prueba.');
          result.push({url:pathToFileURL(file).href, scriptId:entry.scriptId, functions:entry.functions});
        }
        const directory = process.env.NODE_V8_COVERAGE;
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'browser-'+randomUUID()+'.json'), JSON.stringify({result}));
      }
    },
  };
}
