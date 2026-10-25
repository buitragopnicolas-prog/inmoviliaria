import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Exercise the real adapter without downloading model weights or using a GPU.
await mkdir('.local', { recursive: true });
const outfile = resolve('.local/ai-runtime-test.mjs');
await build({
  entryPoints: ['apps/web/lib/run-ai-tool.ts'], outfile, bundle: true,
  platform: 'node', format: 'esm', sourcemap: 'inline', sourcesContent: true,
  plugins: [{ name: 'model-boundary', setup(builder) {
    builder.onResolve({ filter: /^runonweb\// }, ({path}) => ({path, namespace: 'sdk'}));
    builder.onLoad({filter: /.*/, namespace: 'sdk'}, () => ({contents: `
      export const read=(...args)=>globalThis.__model.read(...args);
      export const caption=(...args)=>globalThis.__model.caption(...args);
      export const removeBackground=(...args)=>globalThis.__model.removeBackground(...args);
      export const estimateDepth=(...args)=>globalThis.__model.estimateDepth(...args);
      export const detect=(...args)=>globalThis.__model.detect(...args);
      export const transcribe=(...args)=>globalThis.__model.transcribe(...args);
      export const translate=(...args)=>globalThis.__model.translate(...args);
      export const embed=(...args)=>globalThis.__model.embed(...args);
      export const cosineSimilarity=(...args)=>globalThis.__model.cosineSimilarity(...args);
      export const classify=(...args)=>globalThis.__model.classify(...args);
      export const clean=(...args)=>globalThis.__model.clean(...args);
      export const emojify=(...args)=>globalThis.__model.emojify(...args);
      export const isWebGPUAvailable=()=>globalThis.__model.isWebGPUAvailable();
      export const generateImage=(...args)=>globalThis.__model.generateImage(...args);
      export class TextToSpeech {
        constructor(options){globalThis.__model.speechOptions=options;}
        speakToBlob(text){return globalThis.__model.speakToBlob(text);}
        dispose(){globalThis.__model.disposed=true;}
      }
    `, loader: 'js'}));
  }}],
});
const {runAiTool} = await import(pathToFileURL(outfile));
const input = {text: 'Casa luminosa', secondText: 'Apartamento amplio', from: 'es', file: new File(['photo'], 'photo.png', {type:'image/png'})};
const progress = () => {};
afterEach(() => { delete globalThis.__model; });

test('el adaptador entrega archivos, texto y progreso sin iniciar operaciones ajenas', async () => {
  const blob = new Blob(['synthetic-image']);
  for (const [id, method, sdkOutput, expected] of [
    ['ocr','read',{text:'Documento'},{text:'Documento'}],
    ['caption','caption',{text:'Sala'},{text:'Sala'}],
    ['remove-bg','removeBackground',blob,{blob,media:'image'}],
    ['depth','estimateDepth',{depth:blob},{blob,media:'image'}],
    ['stt','transcribe',{text:'Nota de voz'},{text:'Nota de voz'}],
    ['translate','translate',{text:'Bright house'},{text:'Bright house'}],
    ['clean','clean',{text:'Clean text'},{text:'Clean text'}],
    ['emoji','emojify',{text:'🏡'},{text:'🏡'}],
  ]) {
    let received;
    globalThis.__model = {[method]: async (...args) => { received=args; return sdkOutput; }};
    assert.deepEqual(await runAiTool(id,input,progress), expected);
    assert.equal(received[1].onProgress, progress);
    assert.equal(received[0], ['ocr','caption','remove-bg','depth','stt'].includes(id) ? input.file : input.text);
    if(id==='stt'){assert.equal(received[1].language,'es');assert.equal(received[1].model,'onnx-community/whisper-tiny');}
    if(id==='caption') assert.equal(received[1].language,'es');
    if(id==='translate') assert.equal(received[1].to,'en');
  }
  globalThis.__model = {translate: async (_text, options) => ({text: options.to})};
  assert.deepEqual(await runAiTool('translate',{...input,from:'en'},progress),{text:'es'});
});

test('detección y comparación conservan el carácter orientativo de sus resultados', async () => {
  globalThis.__model={detect:async()=>[]};
  assert.deepEqual(await runAiTool('detect',input,progress),{text:'No se detectaron objetos.'});
  globalThis.__model.detect=async()=>[{label:'chair',score:.75,box:[0,0,10,10]}];
  assert.match((await runAiTool('detect',input,progress)).text,/chair: 75.0 %/);
  globalThis.__model={embed:async texts=>{assert.deepEqual(texts,[input.text,input.secondText]);return {embeddings:[[1],[2]]};},cosineSimilarity:()=>.81234};
  assert.match((await runAiTool('embed',input,progress)).text,/0.812.*no una verificación/);
  globalThis.__model={classify:async request=>{assert.ok(request.questions.asunto.criteria.mantenimiento);return {answers:{asunto:{choice:'visitas'}}};}};
  assert.match((await runAiTool('classify',input,progress)).text,/visitas.*Revisa/);
});

test('la narración libera su modelo tanto al completar como al fallar', async () => {
  const blob=new Blob(['synthetic-audio']);
  globalThis.__model={speakToBlob:async()=>blob};
  assert.deepEqual(await runAiTool('tts',input,progress),{blob,media:'audio',text:input.text});
  assert.equal(globalThis.__model.speechOptions.language,'es');
  assert.equal(globalThis.__model.disposed,true);
  globalThis.__model={speakToBlob:async()=>{throw new Error('Synthetic model failure');}};
  await assert.rejects(runAiTool('tts',input,progress),/Synthetic model failure/);
  assert.equal(globalThis.__model.disposed,true);
});

test('crear imágenes exige WebGPU antes de iniciar la generación y propaga fallos', async () => {
  globalThis.__model={isWebGPUAvailable:async()=>false,generateImage:()=>{throw new Error('Must not load');}};
  await assert.rejects(runAiTool('image',input,progress),/WebGPU/);
  const blob=new Blob(['synthetic-result']);
  globalThis.__model={isWebGPUAvailable:async()=>true,generateImage:async()=>({image:blob})};
  assert.deepEqual(await runAiTool('image',input,progress),{blob,media:'image'});
  globalThis.__model={read:async()=>{throw new Error('Model download unavailable');}};
  await assert.rejects(runAiTool('ocr',input,progress),/Model download unavailable/);
});
