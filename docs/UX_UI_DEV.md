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

Paleta original (histórica): bosque #0D5A40 y #184837, dorado #B79A48,
crema #FAF7EF y menta #EEF4EF. La primera intervención conservó el verde
como secundario; la identidad actual sustituye ese uso por azul.

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

Paleta actual: azul #102A43 para marca, títulos, navegación y acciones
principales; azul #234F76 para detalles secundarios. Dorado #B79A48 para
líneas y acentos, nunca texto pequeño de bajo contraste. Blanco y gris
#F5F7F9 para superficies y fondo. El verde se reserva para estados positivos
como éxito, pago aprobado o disponibilidad; no forma parte del logo ni de
los acentos decorativos.
Tokens semánticos en globals.css para color, espacio, radio, sombra, ancho y
transición. Cormorant para títulos editoriales; Source Sans para controles,
tablas y módulos operativos. Familia SVG outline local para iconos.

## Primera intervención (histórica)

1. Consolidar tokens, estados, tipografía y accesibilidad transversal.
2. Navegación responsive con ruta activa, footer institucional y panel operativo.
3. Hero con fotografía del catálogo existente cuando esté disponible; fichas,
   filtros y formularios compartidos. Sin inventar servicios jurídicos,
   certificaciones, políticas o cifras que el contenido actual no acredita.
4. Compilar, validar tipos y revisar render local a varios tamaños.

Los cambios de estado del menú son exclusivamente de presentación. Ningún
handler comercial, endpoint ni autorización se reemplaza. Se reutilizan las
clases de formularios, cards y tablas para evitar reescribir lógica de módulos.

## Validación de la primera intervención (histórica)

- `npm run check`: correcto en ambos workspaces. El script llamado lint en
  este repositorio ejecuta TypeScript (`tsc --noEmit`), no ESLint.
- `npm run build -w @inmobiliaria/web`: correcto; todas las rutas compiladas.
  La versión instalada reportada por el build es Next.js 16.3.6.
- Navegador real sobre `http://localhost:3000`, consumiendo exclusivamente la
  API de `https://dev.asesoriainmobiliariajb.com` mediante variables del proceso.
  No se modificaron archivos de configuración de entornos ni se desplegó.
- Inicio, catálogo, nosotros, contacto, registro y ficha comprobados a
  320, 768 y 1440 px: sin overflow horizontal del documento ni imágenes rotas
  detectadas. Login revisado a 768 px; noticias con estado vacío revisado.
- Búsqueda por Chicó devuelve un inmueble y conserva el filtro en la URL.
- Menú móvil: abre, navega, cierra con Escape y devuelve foco al botón.
- Se corrigió en un segundo ciclo el salto de línea del header a 320 px.
- Se sustituyó el recorte de imágenes SVG de seed en el hero por una ilustración
  arquitectónica decorativa local. Cuando hay una fotografía disponible se usa
  el inmueble real. Las imágenes de las fichas se conservan.
- Login muestra loading y el error accesible enviado por la API. Las credenciales
  de ejemplo del README son rechazadas en DEV. `/admin` y `/mi-cuenta` redirigen
  correctamente a login sin sesión.

### Pendientes explícitos

Se necesita una sesión válida de DEV para evaluar visualmente dashboard, tablas
con datos privados, contratos y pagos. Los estilos compartidos están implementados,
pero estos flujos no se consideran verificados de extremo a extremo. No se
enviaron solicitudes de contacto, registros, facturas ni pagos de prueba. Docker
Desktop no estaba iniciado, por lo que no se levantó la base de datos local.

El contenido existente no acredita servicios jurídicos específicos ni políticas
legales publicadas: no se inventaron enlaces legales, certificaciones o promesas.
La revisión visual pública no equivale a una auditoría WCAG completa.
