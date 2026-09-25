# Imágenes de ambientación para la portada local

Fecha: 24 de septiembre de 2026.

## Procedencia y uso

Se generaron dos escenas originales mediante la herramienta integrada `image_gen.imagegen`, siguiendo la skill `C:/Users/User/.codex/skills/.system/imagegen/SKILL.md`. No se usó CLI, API key, banco de imágenes ni imágenes de otra inmobiliaria como referencia. Cada escena procede de una llamada separada.

Son imágenes conceptuales de ambientación, no fotografías de inmuebles disponibles ni evidencia de un edificio, cliente o proyecto real de JB. La UI debe identificarlas como **Imagen de referencia**. No usarlas dentro de fichas o inventario como si representaran las propiedades ofrecidas.

Los PNG originales se copiaron al proyecto; los originales de la herramienta se conservaron. Se inspeccionaron visualmente las generaciones y los WebP optimizados: sin personas, textos, logos ni marcas de agua; arquitectura y materiales coherentes; composición apta para los usos previstos.

## Archivos

Todos están bajo `apps/web/public/images/`.

| Archivo | Dimensiones | Peso |
| --- | --- | ---: |
| `jb-architecture-hero.png` | 1672 × 941 | 2.461.761 bytes |
| `jb-architecture-hero-1920.webp` | 1920 × 1081 | 246.740 bytes |
| `jb-architecture-hero-960.webp` | 960 × 540 | 94.026 bytes |
| `jb-interior.png` | 1448 × 1086 | 2.558.106 bytes |
| `jb-interior-1200.webp` | 1200 × 900 | 176.296 bytes |

El exterior original tiene una relación prácticamente 16:9. La variante de 1920 px es una ampliación leve del original, no una generación con detalle nativo adicional. Se preservó toda la imagen al mantener la relación de aspecto; de ahí su altura de 1081 px. El interior es 4:3 y permite un encuadre editorial vertical mediante CSS sin alterar el archivo original.

Optimización con `sharp` instalado en el proyecto: `resize({ width })`, `webp({ quality: 85, effort: 6 })`. Solo cambia tamaño y formato; no se retocaron escenas, colores ni objetos. Preferir los WebP en la web; conservar los PNG como fuentes.

## Prompt exterior

```text
Use case: photorealistic-natural. Asset type: original conceptual editorial architectural photograph for the hero of a Colombian premium real estate and legal services website. Primary request: photograph-like exterior of an imagined premium contemporary mid-rise residential building in Bogotá, Colombia. Warm brick, pale natural stone, expansive elegant glazing, rigorous understated architecture, a few restrained planted terraces. Soft blue twilight sky, warm interior light, believable natural material textures, calm refined atmosphere. Composition: horizontal 16:9 frame at approximately 2048x1152, main building predominantly on the right two thirds, quieter open negative space on the left for website text overlay, eye-level architectural perspective with natural straight verticals. Scene should feel recognizably plausible for an upscale Bogotá neighborhood without copying an identifiable building. Avoid people, cars dominating foreground, text, lettering, signs, branding, logos, watermarks, excessive CGI gloss, oversaturated colors, luxury clichés. No reference images; create an original scene. This is a reference mood image, not a real property listing.
```

Archivo original de herramienta:

`C:/Users/User/.codex/generated_images/01a0d51c-1b33-7b43-97c3-dc2eb12cfc8b/exec-7f2f5a49-4804-457c-9fb8-441f1d3a7e3c.png`

## Prompt interior

```text
Use case: photorealistic-natural. Asset type: original editorial architectural interior photograph for a premium Colombian real estate website, presented as a conceptual reference image. Primary request: a luminous contemporary premium apartment living room in Bogotá, Colombia. Restrained pale natural stone, warm oak joinery and flooring, softly textured cream upholstery, floor-to-ceiling glazing with discreet greenery and a soft urban view. Elegant lived-in realism without people, calm spacious architecture, tasteful minimal furniture. Style: high-end architectural magazine photography, authentic materials, natural daylight and soft shadows, eye-level wide room view, straight verticals, convincing details rather than glossy CGI. Composition: 4:3 horizontal source approximately 1600x1200, central furniture and architectural focus composed to remain usable in a tall 4:5 editorial crop; keep important details away from the extreme sides. Avoid text, lettering, signs, logos, watermarks, people, excessive decoration, oversaturation, surreal proportions. No reference images; create an original imagined interior. This is a mood image, not a real property listing.
```

Archivo original de herramienta:

`C:/Users/User/.codex/generated_images/01a0d51c-1b33-7b43-97c3-dc2eb12cfc8b/exec-92558bbd-3bee-4d88-ac7e-9ccdf17cbc1e.png`

## Alcance

Entregables locales. La generación y optimización no modificó código UI, lógica de negocio, API ni datos. No se realizó commit, push ni despliegue.

