import { readFile, writeFile } from 'node:fs/promises';

// Docker and Linux scanners must resolve reports produced on Windows too.
const file = new URL('../coverage/lcov.info', import.meta.url);
const report = await readFile(file, 'utf8');
await writeFile(file, report.replace(/^SF:(.+)$/gm, (_, path) => `SF:${path.replaceAll('\\', '/')}`));
