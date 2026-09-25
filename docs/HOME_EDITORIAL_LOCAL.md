# HOME editorial — revisión local

Fecha de validación: 24 de septiembre de 2026, America/Bogota.

## Alcance y restauración

Primera versión disponible en http://localhost:3000/. Rama de trabajo:
`codex/home-editorial-local`. Punto de restauración anterior:
`codex/restore-before-home-evolution-20260924`, commit `74e8bb3`.

Esta intervención no se publica. Por instrucción expresa del usuario, DEV
requiere **APROBADO PARA DEV**; producción requiere una autorización distinta:
**APROBADO PARA PRODUCCIÓN**. No se ha hecho push, PR, merge ni despliegue de
esta versión.

El frontend se ejecuta localmente y consulta la API de DEV ya configurada.
No se modificaron datos durante esta revisión. Las pruebas de fallos HTTP usan
una API simulada local independiente. No se afirma que exista una base de datos
local operativa ni que se hayan probado sesiones autenticadas completas.

## Auditoría y comparación

Stack existente: Next.js 16.3.6, React 19, App Router, TypeScript, Server
Components y Server Actions. Estilos globales y CSS Modules. Backend
NestJS/Prisma conservado. Se reutilizan `PropertyCard`, `NewsCard`, `UiIcon`,
`DataUnavailable`, navegación, footer, tipografías y logo aprobado.

La HOME anterior combinaba hero dividido con ilustración, datos de confianza,
tarjetas de catálogo y beneficios. Su composición no daba suficiente peso a la
arquitectura ni diferenciaba claramente las etapas del servicio. Persistían
acentos verdes decorativos y reglas duplicadas del hero.

Referencia conceptual inspeccionada en escritorio y móvil:
[Trebet](https://www.trebet.co/). Se observaron una entrada fotográfica
inmersiva, tipografía de gran escala, narración numerada, alternancia de fondos
y aparición progresiva de contenido. Sus recursos visuales, marca, textos,
promesas comerciales, composiciones exactas y código no se copiaron. Tampoco
se reprodujo su navegación horizontal de módulos: aquí el recorrido permanece
vertical y utilizable con teclado y en pantallas pequeñas.

## Arquitectura implementada

1. Hero arquitectónico original, propuesta breve y accesos a catálogo/contacto.
2. Enfoque de servicio con tres enlaces editoriales: inmuebles, administración
   mediante contacto y cuenta del arrendatario.
3. Inmuebles destacados con los mismos datos, valores COP, características y
   rutas que antes.
4. Contratos y gestión documental, con imagen de interior de referencia.
5. Cuenta digital: descripción de contratos, facturas e historial disponibles.
6. Noticias, conservando resultados, vacío y servicio no disponible.
7. Contacto y footer institucional existente.

No se inventaron servicios jurídicos especializados, asesorías verificadas,
ventas, garantías, cifras, testimonios, firma electrónica ni pagos activos.
La descripción de contratos refleja funciones comprobables del repositorio.

## Decisiones visuales y componentes

- Azul principal `#102A43`, secundario `#234F76`, dorado original `#B79A48`,
  superficies blancas y grises. Verde reservado para estados semánticos de éxito.
- Cormorant Garamond para títulos editoriales; Source Sans 3 para texto y
  controles. Se mantiene una única familia de iconos SVG del proyecto.
- `HomeSections.tsx` divide la portada en secciones; sus estilos quedan
  encapsulados en `HomeSections.module.css`.
- `Reveal` mantiene HTML visible sin JavaScript, activa apariciones una sola
  vez y respeta foco, impresión y preferencia de movimiento reducido.
- Hero con movimiento de escala leve y único. En móvil y con movimiento
  reducido se suprime esa animación.
- `PropertyCard` conserva fotografía, precio, especificaciones y enlace.
  Las ilustraciones de datos de muestra se identifican como referencia; las
  fotografías reales no reciben el filtro de las ilustraciones SVG.
- Limpieza de reglas de la antigua HOME sin consumidores; ajustes de color
  compartidos y footer de dos columnas en tableta.

Las escenas de exterior e interior fueron generadas mediante la herramienta
integrada de imágenes y se presentan como **Imagen de referencia**, nunca como
inventario real. Los WebP sirven la interfaz; los PNG conservan los originales.
[Procedencia, archivos y prompts exactos](ASSETS_HOME_LOCAL.md).

## Validación

- `npm run build`: correcto, API y web; sin cambios de esquema ni migraciones.
- `npm run check`: correcto en ambos workspaces. El script `lint` ejecuta
  TypeScript, no ESLint.
- `npm run test:regressions`: 14 pruebas correctas.
- `npm run test:web-errors`: 10 escenarios correctos, incluyendo API caída,
  fallo parcial, catálogo vacío, filtros inválidos y recursos inexistentes.
- Verificación HTTP local: 22 comprobaciones correctas de rutas públicas,
  redirecciones de acceso privado, búsqueda y hashes de recursos de marca.
- Inspección visual a 1440, 768, 390 y 320 px: sin desbordamiento horizontal;
  hero, tipografía, cards, documentación, cuenta, contacto y footer revisados.
- Menú móvil, cierre con Escape, foco visible, ancla de introducción y acceso
  al catálogo comprobados en navegador.
- Un solo H1; imágenes cargadas sin errores; preferencias de movimiento y
  contenido sin JS revisados en la implementación.

La primera ejecución de regresiones dentro del sandbox falló antes de cargar
las pruebas por `uv_os_get_passwd ENOMEM` de `tsx` en Windows. La ejecución local
con permiso ampliado pasó. Persiste un aviso no bloqueante de Node al inferir
ES modules en la prueba de fechas; no se cambia el modo de módulos del proyecto
para silenciarlo.

Pendiente: revisión visual del usuario en localhost y autorización explícita
antes de cualquier publicación en DEV.
