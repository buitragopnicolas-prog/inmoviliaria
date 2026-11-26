# Identidad visual de Asesoría Inmobiliaria JB

## Originales y variantes

La firma procede de `Designer.png` (1254 × 1254 px). Los contornos del monograma JB, el horizonte y las letras se trazaron por separado a partir de la imagen entregada por la inmobiliaria. Los diez iconos de servicios y valores proceden de `Designer (1).png` (1024 × 1024 px). Las fuentes vectoriales del proyecto son `apps/web/lib/brand-mark.json`, `brand-wordmark.json` y `brand-icons.json`. Para regenerar los SVG y el favicon a partir de estos trazados se ejecuta `node scripts/generate-brand-assets.mjs`. La [lámina descargable](http://127.0.0.1:3125/brand/index.html) contiene las tres firmas y los diez iconos.

La cabecera recompone el monograma, el horizonte y las dos palabras en horizontal. Las palabras permanecen legibles en teléfonos estrechos. En el pie se conserva la disposición del PNG con la firma completa en blanco. La variante para papel o superficies claras combina azul noche con el horizonte dorado. La figura del favicon se simplifica mediante un ligero refuerzo del trazo. El nombre accesible de cada instancia procede de la identidad configurada en el CMS.

## Paleta y tipografía

El azul noche `#0A1A2C` sostiene los paneles. El dorado `#C9A77B` identifica la marca, los precios, los CTA y la luz del puntero. Los textos de lectura se componen en blanco y en el beige de la muestra de la lámina (`#F0E5D6`). El valor cálido `#F6E90B` indicado en el encargo se reserva al tinte de vidrio al 5 %. Playfair Display identifica los títulos y los precios. Montserrat se usa en la navegación, los formularios y las leyendas. Next sirve ambas fuentes desde el propio sitio.

La implementación compartida está en `BrandLogo.tsx`, `BrandIcon.tsx` y `components/skyline/brand.css`. La escena animada y su alternativa estática comparten el horizonte dorado. Cada efecto respeta la preferencia de movimiento reducido.
