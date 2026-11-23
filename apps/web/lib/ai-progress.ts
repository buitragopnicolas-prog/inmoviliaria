import type { ProgressInfo } from 'runonweb/core';
import type { AiToolId } from './ai-tools';

const operations: Record<string, string> = {
  recognizing: 'Reconociendo texto', captioning: 'Describiendo la imagen', transcribing: 'Transcribiendo audio',
  synthesizing: 'Generando narración', translating: 'Traduciendo', embedding: 'Comparando textos',
  classifying: 'Clasificando la consulta', cleaning: 'Limpiando el texto', generating: 'Generando la imagen',
  processing: 'Procesando', initializing: 'Inicializando el modelo', ready: 'Modelo listo',
};

export type AiProgress = {
  label: string;
  bars: Record<string, number>;
  aggregate?: boolean;
};

export function aiProgress(tool: AiToolId, event: ProgressInfo, previous: AiProgress | null): AiProgress {
  const { status, file } = event;
  const measured = event.progress ?? (event.total !== undefined && event.total > 0 && event.loaded !== undefined ? 100 * event.loaded / event.total : undefined);
  const percent = typeof measured === 'number' && Number.isFinite(measured)
    ? Math.round(Math.min(100, Math.max(0, measured))) : undefined;
  if (status === 'progress_total' || (tool === 'ocr' && status === 'progress')) {
    return { label: 'Descargando el modelo', aggregate: true, bars: percent === undefined ? {} : { 'Descarga total': percent } };
  }
  if (['initiate', 'download', 'progress'].includes(status) || (status === 'done' && file)) {
    if (previous?.aggregate) return previous;
    const bars = previous?.label === 'Descargando el modelo' ? { ...previous.bars } : {};
    const name = file || 'Descarga';
    if (status === 'done' || percent === undefined) delete bars[name];
    else bars[name] = percent;
    return { label: 'Descargando el modelo', bars };
  }
  const label = tool === 'emoji' && status === 'translating' ? 'Generando emojis'
    : status === 'done' ? 'Finalizando el resultado' : operations[status] ?? 'Preparando el modelo';
  const measurable = status.startsWith('loading') || status === 'generating';
  return { label, bars: measurable && percent !== undefined ? { [label]: percent } : {} };
}
