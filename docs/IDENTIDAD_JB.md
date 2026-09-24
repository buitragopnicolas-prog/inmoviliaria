# Identidad JB — evolución del logo

## Concepto

Se conserva el nombre Asesoría Inmobiliaria JB. El símbolo se dibuja desde cero
con las iniciales JB: una J que desciende hasta una base firme y una B con dos
espacios interiores. El ritmo vertical alude a estructura y orden documental;
la línea inferior representa apoyo y estabilidad. Se elimina el tejado y no
se incorporan casas, balanzas ni recursos de terceros.

Azul #102A43 y dorado #B79A48, ya presentes en la interfaz. Sobre fondos oscuros,
blanco y dorado #CFB670. La variante monocromática usa una sola tinta. No hay
verde ni degradados dentro del logo. Los colores funcionales del resto del
producto se conservan.

Source Sans 3 semibold para el nombre y descriptor; es la familia existente del
producto. No se introduce otra fuente ni se cambia el nombre comercial. La
composición horizontal organiza «Asesoría» sobre «Inmobiliaria JB», con lema
opcional. El footer emplea composición vertical y versión inversa.

## Implementación y entregables

- `apps/web/lib/brand-mark.json`: geometría y paleta maestras del isotipo.
- `BrandLogo.tsx` y `BrandLogo.module.css`: componente compartido, variantes
  `tone="light|dark|monochrome"`, `compact`, `stacked` y lema opcional.
- `public/brand/logo-{light,dark,mono,mono-white}.svg`: versiones horizontales.
- `public/brand/isotype-{light,dark,mono,mono-white}.svg`: símbolo independiente.
- `public/brand/favicon.svg` y `app/icon.svg`: versión simplificada para navegador.
- `public/brand/index.html`: lámina comparativa y descargas en `/brand/index.html`.

Regenerar los SVG con `node scripts/generate-brand-assets.mjs` después de cambiar
la geometría maestra. No requiere dependencias adicionales. Todos los SVG están
trazados: conservan su aspecto sin instalar fuentes. El lettering se almacena en
`apps/web/lib/brand-wordmark.json`, con la procedencia, versión, copyright y hash
de la Source Sans 3 existente. En la web se usa la fuente que Next ya carga.

Si cambia el nombre o la tipografía, `scripts/outline-brand-wordmark.py` convierte
los glifos de una Source Sans 3 WOFF2 a contornos (peso 600). Requiere fonttools y
brotli únicamente como herramientas de autoría; no son dependencias del producto.
Se utilizaron en `.local/brand-tools`, fuera del código versionado. Ejecución:

```powershell
$env:PYTHONPATH = '.local/brand-tools'
python scripts/outline-brand-wordmark.py <ruta-a-Source-Sans-3-latin.woff2>
node scripts/generate-brand-assets.mjs
```

No se redistribuye la fuente completa: únicamente los contornos de las palabras
del nombre comercial. Los metadatos del archivo fuente identifican a Adobe y la
licencia OFL.

Header, menú móvil, login, cuenta y administración reciben la marca a través del
layout existente. No se duplican logos dentro de formularios o paneles. No hay
cambios en autenticación, datos, permisos, rutas de negocio o API.

## Reglas de uso

Mantener el aspecto del SVG. Espacio de protección mínimo: un ancho de trazo
del monograma. Isotipo completo recomendado desde 32 px; favicon simplificado
a 16–32 px. No aplicar sombras, contornos, degradados ni recolorear las letras
individualmente. Usar blanco sobre azul, azul sobre blanco, o una tinta en
materiales donde no sea posible reproducir el acento dorado.

El diseño se creó para este proyecto sin copiar logotipos de referencia. No se
realizó búsqueda registral ni se afirma exclusividad jurídica frente a marcas
existentes; la originalidad del dibujo no sustituye esa verificación.

## Validaciones

Build de Next y comprobación TypeScript completados. Revisión del header a
320, 375, 768, 1024 y 1440 px: sin overflow, navegación en una fila, azul correcto
en la marca y favicon declarado por Next. Variante blanca comprobada sobre el
footer azul en login. Nombre accesible único en enlace de inicio y logo del
footer. Lámina revisada con versiones clara, oscura, monocromática y favicon
a 16, 32 y 48 px. No se requiere acceso a datos privados para estos cambios del
layout compartido. No se desplegó.
