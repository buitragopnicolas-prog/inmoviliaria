# Asesoría Inmobiliaria JB — contexto visual

La web usa Next.js App Router, React, TypeScript y CSS Modules. El catálogo y
los inmuebles destacados proceden de la API. Conservar estados vacíos y de error;
no inventar inmuebles, reseñas ni estadísticas.

## Identidad y componentes

- Bogotá persiste tras el contenido. Usar las superficies translúcidas, el azul noche y el dorado definidos en `apps/web/components/skyline/brand.css`. Los textos y los controles comparten esos tokens.
- Playfair Display para titulares y precios, y Montserrat para la navegación, el texto y los controles. Los originales gráficos y sus variantes están documentados en [Identidad JB](../docs/IDENTIDAD_JB.md).
- Reutilizar `UiIcon`, `Reveal`, `next/image` y `next/link`; preservar etiquetas,
  foco visible, diseño adaptable y preferencias de movimiento reducido.
- Buscador del inicio: formulario GET a `/inmuebles`, con `search`, `city` y
  `maxRent`. Funciona sin JavaScript.
- Tarjetas con una sola zona de enlace, disponibilidad real, canon mensual,
  administración cuando corresponde y características visibles sin hover.

## Referencias consultadas

Se recuperó el código de estas referencias de 21st y se adaptaron sus patrones
a los componentes existentes sin instalar sus dependencias:

- [Real Estate Search Hero](https://21st.dev/@felipemenezes098/components/hero-09):
  búsqueda principal y fotografía arquitectónica. Se sustituyó el submit de
  demostración por la búsqueda real del catálogo.
- [Property Preview Card](https://21st.dev/@shadcnspace/components/card-02):
  fotografía prominente, características agrupadas y enlace al detalle,
  conservando datos reales y navegación con teclado.

## Herramientas gratuitas y locales

Por instrucción posterior del usuario, preferir el MCP oficial de shadcn/ui
`shadcn-local`, instalado en el equipo y registrado en Codex. Se comprobaron sus
herramientas de búsqueda, consulta de `card`/`input-group` y revisión.

El servidor tiene licencia MIT y su catálogo estándar no requiere cuenta, clave
ni suscripción. Consultarlo requiere internet; no es completamente offline.
No usar registros de pago ni contratar planes. Las referencias ya adaptadas a
JB se ejecutan dentro de la propia web.

Documentación: https://ui.shadcn.com/docs/mcp

En los escaparates se conserva la imagen, el precio publicado y un solo enlace por activo. Las barras muestran una proyección bruta cuando la oferta cuenta con un canon mensual estimado. [Glassy Coverflow Carousel](https://21st.dev/@automateflows/components/glassy-coverflow-carousel) · [Sales Overview Bar Chart](https://21st.dev/@shadcnspace/components/chart-01)
