import test from 'node:test';
import assert from 'node:assert/strict';
import { aiTools, validateAiInput } from './ai-tools';
import nextConfig from '../next.config';

test('IA valida entradas antes de descargar modelos', () => {
  assert.match(validateAiInput('ocr', '', '', null)!, /Selecciona/);
  assert.match(validateAiInput('ocr', '', '', new File(['hola'], 'voz.wav', { type: 'audio/wav' }))!, /imagen/);
  assert.match(validateAiInput('stt', '', '', new File([], 'voz.wav', { type: 'audio/wav' }))!, /vacío/);
  assert.equal(validateAiInput('ocr', '', '', new File(['foto'], 'foto.png', { type: 'image/png' })), null);
  assert.match(validateAiInput('embed', 'Casa luminosa', '', null)!, /segundo/);
  assert.match(validateAiInput('translate', 'x'.repeat(4001), '', null)!, /4000/);
  assert.match(validateAiInput('tts', '  ', '', null)!, /Escribe/);
  assert.equal(validateAiInput('translate', 'Casa luminosa', '', null), null);
});

test('IA limita tamaño de archivos y mantiene un catálogo sin duplicados', () => {
  const large = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
  assert.match(validateAiInput('ocr', '', '', large)!, /25 MB/);
  assert.equal(aiTools.length, 13);
  assert.equal(new Set(aiTools.map((tool) => tool.id)).size, 13);
});

test('los permisos de modelos y WASM se limitan a herramientas IA', async () => {
  const rules = await nextConfig.headers!();
  const global = rules.find((rule) => rule.source === '/(.*)')!;
  const ai = rules.find((rule) => rule.source === '/herramientas-ia')!;
  const policy = (rule: typeof global) => rule.headers.find((header) => header.key === 'Content-Security-Policy')!.value;
  assert.match(policy(global), /connect-src 'self';/);
  assert.doesNotMatch(policy(global), /wasm-unsafe-eval|huggingface/);
  assert.match(policy(ai), /'wasm-unsafe-eval'/);
  assert.match(policy(ai), /worker-src 'self' blob:/);
  assert.match(policy(ai), /https:\/\/huggingface.co/);
  assert.match(policy(ai), /object-src 'none'/);
  assert.match(policy(ai), /frame-ancestors 'none'/);
});
