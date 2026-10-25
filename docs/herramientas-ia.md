# Herramientas IA en el navegador

La ruta `/herramientas-ia`, enlazada desde el menú y el pie de página, integra
los 13 módulos de `runonweb@0.1.0`: OCR, descripción de imágenes, eliminación
de fondo, profundidad, detección, transcripción, narración, traducción,
embeddings, clasificación, limpieza, emojis y generación de imágenes.

Los módulos se importan al procesar una entrada válida. Los modelos se
descargan desde Hugging Face y los recursos WASM desde jsDelivr; el SDK
puede conservarlos en la caché del navegador. Los archivos y resultados
no se envían a la API inmobiliaria ni se guardan en el catálogo. Los modelos
se liberan después de cada ejecución. Se permiten archivos de hasta 25 MB
y textos de hasta 4000 caracteres.

## Compatibilidad y condiciones

- WebGPU cuando el SDK lo admite; alternativa WASM según el módulo.
- La generación de imágenes requiere WebGPU y descarga unos 3,4 GB.
- Transcripción: Whisper tiny multilingüe, español. Narración: Supertonic 2,
  español. Traducción: español e inglés mediante Firefox Translations.
- Limpieza S1-mini, embeddings MiniLM y emojis funcionan mejor en inglés.
- La descripción LFM2.5-VL está sujeta a LFM Open License: empresas con
  ingresos anuales de USD 10 millones o más necesitan licencia comercial.
  Supertonic 2 usa OpenRAIL-M. Consultar las condiciones de cada modelo
  antes de publicar; el MIT del SDK no sustituye las licencias de modelos.
- Las imágenes generadas se presentan como conceptuales. Las salidas son
  borradores y no ejecutan decisiones administrativas ni cambian documentos.

La política CSP permite los dominios de modelos, workers blob y compilación
WASM únicamente en esta ruta. Entrar y salir utiliza navegación completa
para cargar la política correspondiente. Las políticas de cámara y micrófono
siguen desactivadas: la transcripción utiliza un archivo de audio.

## Validación

```sh
npm run lint -w @inmobiliaria/web
npm run test:ai -w @inmobiliaria/web
npm run test:web-components
npm run build -w @inmobiliaria/web
```

Verificación manual: ejecutar una herramienta tras pulsar Procesar, comprobar
progreso y resultado, descargar PNG/WAV cuando corresponda y comprobar móvil.
No hay descargas de modelos al abrir la página. La ejecución de cada modelo
depende de la memoria, navegador y disponibilidad de sus archivos externos.

Se consultó el complemento oficial 21st (AI Input With File, id 1190), pero
la recuperación de código estaba bloqueada por su cuota gratuita; se
reutilizaron formularios, botones y tokens JB sin copiar ese componente.
