# Rediseño UX/UI — desarrollo

## Auditoría inicial

Base: `63b2524`; restauración: `codex/restore-before-ui-20260923`.
Trabajo aislado: `codex/corporate-ui-dev`. Sin publicación ni cambios de datos.

Next.js 16 App Router, React 19, TypeScript, CSS global, Server Components y
Server Actions. Backend NestJS/Prisma separado. No hay librería de iconos ni
framework de componentes. Source Sans 3 y Cormorant Garamond ya están instaladas.

Pantallas: inicio, catálogo, ficha con galería/360/video, noticias y detalle,
nosotros, contacto, login, registro, cuenta, pago y contratos; administración de
inmuebles, usuarios, noticias, archivos, facturas, conciliación y contactos.
Los formularios usan acciones compartidas; las tablas se envuelven en
`responsiveTable`. Se conservan rutas, validaciones, permisos y llamadas API.

Paleta original: bosque #0D5A40 y #184837, dorado #B79A48, crema #FAF7EF,
menta #EEF4EF. Se conserva el verde en la marca y como color secundario.

## Diez prioridades

1. Menú público desaparece bajo 1000px sin alternativa móvil.
2. Navegación sin indicación de ubicación actual.
3. Foco de teclado incompleto y falta de salto al contenido.
4. Filtros del catálogo sin etiquetas visibles.
5. Columnas administrativas con mínimos implícitos que desbordan.
6. Hero con paneles superpuestos y marca repetida sin contenido inmobiliario.
7. Cifra +120 sin fuente visible y mensajes de seguridad no verificables.
8. Símbolos Unicode heterogéneos en características de inmuebles.
9. Pendiente y vencido usan el mismo tratamiento visual.
10. Estados disabled y reducción de movimiento ausentes; escalas y radios dispersos.

## Sistema de diseño

Azul #102A43: títulos, navegación, acciones principales. Verde corporativo:
marca y detalles secundarios. Dorado original: líneas y acentos, nunca texto
pequeño de bajo contraste. Blanco y gris #F5F7F9: superficies y fondo.
Tokens semánticos en globals.css para color, espacio, radio, sombra, ancho y
transición. Cormorant para títulos editoriales; Source Sans para controles,
tablas y módulos operativos. Familia SVG outline local para iconos.

## Intervención

1. Consolidar tokens, estados, tipografía y accesibilidad transversal.
2. Navegación responsive con ruta activa, footer institucional y panel operativo.
3. Hero con fotografía del catálogo existente cuando esté disponible; fichas,
   filtros y formularios compartidos. Sin inventar servicios jurídicos,
   certificaciones, políticas o cifras que el contenido actual no acredita.
4. Compilar, validar tipos y revisar render local a varios tamaños.

Los cambios de estado del menú son exclusivamente de presentación. Ningún
handler comercial, endpoint ni autorización se reemplaza. Se reutilizan las
clases de formularios, cards y tablas para evitar reescribir lógica de módulos.
