import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const relativePath = file => path.relative(root, file).split(path.sep).join('/');
const sharedKernel = 'apps/api/src/shared/kernel/';
const coreLayer = /^(apps\/api\/src\/(?:modules\/)?[^/]+)\/(domain|application)\//;
const technicalPackage = /^(?:@nestjs\/|@prisma\/|@opentelemetry\/|@aws-sdk\/|(?:next|express|prisma|pg|minio|multer|class-validator|class-transformer)(?:\/|$))/;
const nodeIO = /^(?:node:)?(?:fs|net|http|https|http2|tls|dgram|child_process|worker_threads)(?:\/|$)/;

function violation(source, specifier, target) {
  if (source.startsWith('apps/web/')) {
    if (target.startsWith('apps/api/') || /^@inmobiliaria\/api(?:\/|$)/.test(specifier)) {
      return 'La web debe consumir la API por su contrato público';
    }
    return;
  }

  const layer = coreLayer.exec(source);
  if (!layer && !source.startsWith(sharedKernel)) return;
  if (technicalPackage.test(specifier) || nodeIO.test(specifier)) return 'El núcleo importa un framework, proveedor o mecanismo de E/S';
  if (target.startsWith(sharedKernel)) return;
  if (layer && target.startsWith(layer[1] + '/domain/')) return;
  if (layer?.[2] === 'application' && target.startsWith(layer[1] + '/application/')) return;
  if (target && !target.split('/').includes('node_modules')) return 'La dependencia sale de las capas interiores de su contexto';
}

test('la web y las capas interiores de la API respetan sus límites de importación', () => {
  const problems = [];
  for (const workspace of ['apps/api', 'apps/web']) {
    const base = path.join(root, workspace);
    const configPath = path.join(base, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    assert.ifError(config.error);
    const project = ts.parseJsonConfigFileContent(config.config, ts.sys, base);
    assert.deepEqual(project.errors.map(error => error.messageText), []);
    const canonicalPath = file => ts.sys.useCaseSensitiveFileNames ? file : file.toLowerCase();
    const cache = ts.createModuleResolutionCache(base, canonicalPath, project.options);
    for (const file of project.fileNames) {
      const source = relativePath(file);
      if (/\/(?:\.next|generated)\/|\.(?:test|spec|d)\.[cm]?tsx?$/.test(source)) continue;
      if (workspace === 'apps/api' && !coreLayer.test(source) && !source.startsWith(sharedKernel)) continue;
      const imports = ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles;
      for (const { fileName: specifier } of imports) {
        const { resolvedModule } = ts.resolveModuleName(specifier, file, project.options, ts.sys, cache);
        const target = resolvedModule ? relativePath(resolvedModule.resolvedFileName) : '';
        const problem = violation(source, specifier, target);
        if (problem) problems.push(`${source} → ${specifier}. ${problem}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('la regla distingue puertos propios, núcleo compartido y adaptadores externos', () => {
  const context = 'apps/api/src/modules/payments';
  const domain = context + '/domain/payment.ts';
  const useCase = context + '/application/charge.ts';
  const adapter = context + '/infrastructure/gateway.ts';
  assert.equal(violation(useCase, '../domain/payment.js', domain), undefined);
  assert.equal(violation(domain, 'money', sharedKernel + 'money.ts'), undefined);
  assert.ok(violation(domain, '../application/charge.js', useCase));
  assert.ok(violation(useCase, '../infrastructure/gateway.js', adapter));
  assert.ok(violation(domain, '@prisma/client', 'node_modules/@prisma/client/index.d.ts'));
  assert.ok(violation(domain, 'node:fs/promises', ''));
  assert.ok(violation(sharedKernel + 'money.ts', 'payment', domain));
  assert.ok(violation('apps/web/lib/api.ts', '../../api/src/main.js', 'apps/api/src/main.ts'));
});
