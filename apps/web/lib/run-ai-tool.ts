import type { ProgressCallback } from 'runonweb/core';
import type { AiToolId } from './ai-tools';

export type AiResult = { text?: string; blob?: Blob; media?: 'image' | 'audio' };

// Every SDK import is deferred until the visitor explicitly starts a task.
// One-shot SDK helpers dispose their model sessions in finally blocks.
export async function runAiTool(id: AiToolId, input: { text: string; secondText: string; file: File | null; from: 'es' | 'en' }, onProgress: ProgressCallback): Promise<AiResult> {
  const options = { onProgress };
  switch (id) {
    case 'ocr': return { text: (await (await import('runonweb/ocr')).read(input.file!, options)).text };
    case 'caption': return { text: (await (await import('runonweb/caption')).caption(input.file!, { ...options, language: 'es', detail: 'detailed' })).text };
    case 'remove-bg': return { blob: await (await import('runonweb/remove-bg')).removeBackground(input.file!, options), media: 'image' };
    case 'depth': return { blob: (await (await import('runonweb/depth')).estimateDepth(input.file!, options)).depth, media: 'image' };
    case 'detect': {
      const objects = await (await import('runonweb/detect')).detect(input.file!, options);
      return { text: objects.length ? objects.map((item) => `${item.label}: ${(item.score * 100).toFixed(1)} % · ${JSON.stringify(item.box)}`).join('\n') : 'No se detectaron objetos.' };
    }
    case 'stt': return { text: (await (await import('runonweb/stt')).transcribe(input.file!, { ...options, model: 'onnx-community/whisper-tiny', language: 'es' })).text };
    case 'tts': {
      const { TextToSpeech } = await import('runonweb/tts');
      const speaker = new TextToSpeech({ ...options, size: 'multi', voice: 'st_f1', language: 'es' });
      try { return { blob: await speaker.speakToBlob(input.text), media: 'audio', text: input.text }; }
      finally { speaker.dispose(); }
    }
    case 'translate': return { text: (await (await import('runonweb/translate')).translate(input.text, { ...options, from: input.from, to: input.from === 'es' ? 'en' : 'es' })).text };
    case 'embed': {
      const { embed, cosineSimilarity } = await import('runonweb/embed');
      const { embeddings } = await embed([input.text, input.secondText], options);
      return { text: `Similitud: ${cosineSimilarity(embeddings[0], embeddings[1]).toFixed(3)} (escala de −1 a 1). Es una comparación orientativa, no una verificación de hechos.` };
    }
    case 'classify': {
      const { classify } = await import('runonweb/classify');
      const { answers } = await classify({ state: input.text, questions: { asunto: { type: 'choice', instructions: 'Clasifica el asunto principal de esta consulta inmobiliaria.', criteria: { arriendos: 'Arrendar un inmueble', visitas: 'Concertar una visita', mantenimiento: 'Reparaciones de un inmueble', otro: 'Cualquier otro asunto' } } } }, options);
      return { text: `Asunto sugerido: ${answers.asunto.choice}. Revisa la sugerencia antes de utilizarla.` };
    }
    case 'clean': return { text: (await (await import('runonweb/clean')).clean(input.text, { ...options, styling: 'semi-formal', structure: 'prose', context: 'general' })).text };
    case 'emoji': return { text: (await (await import('runonweb/emoji')).emojify(input.text, options)).text };
    case 'image': {
      const { isWebGPUAvailable } = await import('runonweb/core');
      if (!(await isWebGPUAvailable())) throw new Error('La generación de imágenes requiere un navegador con WebGPU disponible.');
      return { blob: (await (await import('runonweb/image')).generateImage(input.text, options)).image, media: 'image' };
    }
  }
}
