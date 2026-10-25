export const aiTools = [
  { id: 'ocr', title: 'Extraer texto', kind: 'image', description: 'Lee el texto de una fotografía de un documento.', size: '~31 MB', model: 'PP-OCRv6 · PaddlePaddle · Apache-2.0' },
  { id: 'caption', title: 'Describir una foto', kind: 'image', description: 'Obtén un borrador en español para una fotografía del inmueble.', size: '~316–505 MB', model: 'LFM2.5-VL · Liquid AI · LFM Open License (gratis con ingresos anuales inferiores a USD 10 millones)' },
  { id: 'remove-bg', title: 'Quitar el fondo', kind: 'image', description: 'Crea una imagen PNG con fondo transparente.', size: '~219 MB', model: 'BEN2 · Prama LLC · MIT' },
  { id: 'depth', title: 'Estimar profundidad', kind: 'image', description: 'Visualiza la profundidad de una habitación en escala de grises.', size: '~27–50 MB', model: 'Depth Anything V2 Small · Apache-2.0' },
  { id: 'detect', title: 'Detectar objetos', kind: 'image', description: 'Identifica objetos visibles y sus coordenadas en la foto.', size: '~29 MB', model: 'RF-DETR Nano · Roboflow · Apache-2.0' },
  { id: 'stt', title: 'Transcribir audio', kind: 'audio', description: 'Convierte una nota de voz en español en texto.', size: '~40–150 MB', model: 'Whisper tiny multilingüe · OpenAI · Apache-2.0' },
  { id: 'tts', title: 'Leer en voz alta', kind: 'text', description: 'Genera una narración en español y descarga el audio.', size: '~262 MB', model: 'Supertonic 2 · Supertone · OpenRAIL-M' },
  { id: 'translate', title: 'Traducir texto', kind: 'text', description: 'Traduce descripciones entre español e inglés.', size: '~21–55 MB', model: 'Firefox Translations · Mozilla · MPL-2.0' },
  { id: 'embed', title: 'Comparar textos', kind: 'text', description: 'Calcula la similitud de dos textos; funciona mejor en inglés.', size: '~23–45 MB', model: 'all-MiniLM-L6-v2 · sentence-transformers · Apache-2.0' },
  { id: 'classify', title: 'Clasificar una consulta', kind: 'text', description: 'Sugiere si un mensaje trata de arriendos, visitas o mantenimiento.', size: '~750 MB', model: 'Kev-0.8B · Jared Palmer / runonweb · Apache-2.0' },
  { id: 'clean', title: 'Limpiar una transcripción', kind: 'text', description: 'Elimina muletillas de una transcripción en inglés.', size: '~365–413 MB', model: 'S1-mini by Superwhisper · Apache-2.0 con condición de nombre' },
  { id: 'emoji', title: 'Sugerir emojis', kind: 'text', description: 'Obtén emojis para acompañar un anuncio; funciona mejor en inglés.', size: '~4 MB', model: 'text2emoji-tiny · runonweb · MIT' },
  { id: 'image', title: 'Crear imagen conceptual', kind: 'text', description: 'Genera una ilustración de inspiración. Requiere WebGPU y suficiente memoria.', size: '~3,4 GB', model: 'Bonsai Image 4B · Prism ML · Apache-2.0' },
] as const;

export type AiToolId = typeof aiTools[number]['id'];

export function validateAiInput(id: AiToolId, text: string, secondText: string, file: File | null): string | null {
  const tool = aiTools.find((item) => item.id === id)!;
  if (tool.kind === 'text') {
    if (!text.trim()) return 'Escribe el texto que quieres procesar.';
    if (text.length > 4000 || secondText.length > 4000) return 'Usa un máximo de 4000 caracteres por texto.';
    if (id === 'embed' && !secondText.trim()) return 'Escribe también el segundo texto.';
    return null;
  }
    if (!file) return 'Selecciona un archivo para continuar.';
    if (!file.type.startsWith(`${tool.kind}/`)) return tool.kind === 'image' ? 'Selecciona un archivo de imagen.' : 'Selecciona un archivo de audio.';
    if (file.size > 25 * 1024 * 1024) return 'El archivo debe pesar como máximo 25 MB.';
    if (!file.size) return 'El archivo está vacío.';
  return null;
}
