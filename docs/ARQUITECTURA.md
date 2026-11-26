# Arquitectura técnica — Asesoría Inmobiliaria JB

## Vista general

La solución se organiza como monorepo npm con dos aplicaciones independientes:

```text
Browser
   │
   ▼
Next.js 16 SSR (apps/web) ─────► NestJS 11 REST API (apps/api)
                                      │
                                      ├── PostgreSQL + Prisma ORM 7
                                      ├── MinIO y ClamAV (archivos y medios)
                                      └── Wompi Checkout / Webhook (configurable)
```

## Frontend con Next.js App Router

### Superficies y movimiento en todas las rutas

`apps/web/app/layout.tsx` monta una sola instancia de `BogotaExperienceManager` por documento. Las rutas públicas, los portales y las vistas administrativas comparten el mismo lienzo, la paleta y la preferencia de movimiento. App Router sustituye el contenido de `#contenido`. El panel IA de igual origen utiliza el lienzo del documento principal.

| Responsabilidad | Implementación | Comportamiento |
| --- | --- | --- |
| Escena de Bogotá | `createSkyline.ts` y shaders propios | Three.js compone cerros, ciudad y tejados. GSAP cambia encuadre al navegar y ScrollTrigger acerca la cámara a la calle al llegar al pie. |
| Lectura, formularios y tablas | `immersive.css` y `.glass-panel-total` | Superficies translúcidas, texto claro, foco visible y estados de error o pago identificables. Se conserva el contraste funcional del QR. |
| Interacción | `surfaceMotion.ts` y Motion | Entrada escalonada de paneles, incluidos resultados diferidos. El puntero o el foco resaltan las tarjetas y mejoran la nitidez del fondo. Con movimiento reducido se usa la ilustración estática y se conservan los controles HTML. |
| Arriendos | `FeaturedRentals`, `AssetRail`, `CatalogResults` | Los destacados se recorren con teclado, flechas o gesto táctil. El catálogo muestra filas con foto y los datos publicados. La ficha conserva la galería y abre el mapa bajo petición. |
| Ubicación | Coordenadas públicas del registro | Solo un pin guardado dentro de la extensión urbana representada orienta la cámara. La escena es una ilustración. La ubicación geográfica exacta se consulta en el mapa de la ficha. |
| Venta y bienes | `SaleShowcase`, `InvestmentPanel`, `SaleOfferForm` | El escaparate agrupa por catálogo. Administración puede marcar un inmueble como Premium o Nuevo proyecto y registrar un canon mensual estimado. Los bienes muebles tienen visor propio. |
| Rentabilidad | `GET /sales/comprar` | Porcentaje bruto anual = canon mensual estimado × 12 ÷ precio de venta × 100. El gráfico usa exclusivamente valores positivos publicados y declara los supuestos. Un canon ausente se indica junto al precio. |

Las columnas opcionales `SaleOffer.promotion` y `SaleOffer.estimatedMonthlyRent` se introducen mediante `20261126000100_sale_promotions`. La API mantiene los controles por rol y revisión del editor. Los enlaces usan las rutas canónicas. `/inicio`, `/arriendos`, `/ingreso`, `/herramientas`, `/boletin` y `/boletín` redirigen a los destinos existentes y conservan la consulta.

El frontend utiliza App Router, Server Components y Server Actions. Las páginas que dependen de datos consultan la API con `cache: 'no-store'`; el layout lee la sesión HTTP-only para mostrar navegación por rol. En consecuencia, el catálogo, la cuenta y el panel se renderizan en servidor por solicitud.

Rutas públicas:

- `/`: home con inmuebles destacados.
- `/inmuebles`: catálogo y filtros.
- `/inmuebles/[slug]`: ficha, galería y contacto.
- `/comprar` y `/vehiculos-y-bienes` con sus respectivas fichas.
- `/nosotros`, `/servicios`, `/contacto`, `/sugerencias`, `/noticias`, `/herramientas-ia` y `/solicitud-de-arrendamiento`.
- Entradas por perfil en `/arrendatarios`, `/propietarios` y `/clientes`.
- `/login` y, cuando el entorno local lo habilita, `/registro`.

Rutas autenticadas:

- `/mi-cuenta`: facturas del arrendatario.
- `/mi-cuenta/facturas/[id]/pagar`: flujo de pago.
- `/admin`, `/admin/inmuebles`, `/admin/facturas`, `/admin/contactos`.

## Backend: NestJS

La API expone controladores REST, validación de DTOs y guards JWT por rol:

| Módulo | Responsabilidad |
| --- | --- |
| `auth` | Registro, login JWT y consulta de sesión. |
| `properties` | Catálogo público y gestión administrativa de inmuebles/imágenes. |
| `contacts` | Captura y consulta administrativa de solicitudes. |
| `leases` | Consulta de contratos activos para facturación. |
| `invoices` | Facturas del usuario y generación administrativa. |
| `payments` | Intentos de pago, mock local, Wompi y webhook. |
| `publishing` | Edición del sitio, ofertas, documentos, boletín y publicaciones por propietario. |
| `storage` | Archivos en MinIO, escaneo con ClamAV y control de acceso. |
| `dashboard` | Métricas administrativas. |

## Persistencia: Prisma ORM 7

La implementación adopta las convenciones requeridas por Prisma 7:

- `generator client { provider = "prisma-client"; output = "../src/generated/prisma" }`.
- Configuración de conexión y seed en `apps/api/prisma.config.ts`.
- PostgreSQL mediante `@prisma/adapter-pg` al instanciar `PrismaClient`.
- Seed explícito con `prisma db seed`.

Entidades principales:

```text
User ──< Lease >── Property ──< PropertyImage
 │        │
 │        └──< Invoice ──< Payment
 └── rol ADMIN / USER
ContactMessage (solicitudes públicas)
```

## Autenticación y autorización

- El backend entrega un JWT tras registro o autenticación.
- Next.js almacena el token en cookie `httpOnly`, `sameSite=lax` y `secure` en producción.
- Los endpoints administrativos exigen guard JWT y rol `ADMIN`.
- El usuario únicamente consulta y paga facturas asociadas a su propio identificador JWT.

## Fotografías y documentos

La galería y los escaparates usan el proxy público `/fotos` del mismo origen. Nest entrega las imágenes autorizadas desde el almacenamiento de objetos. Los SVG de muestra tienen rutas específicas. El acceso a contratos, comprobantes y documentos de cuenta se valida por destinatario o rol.

## Pagos

### Modo local

`PAYMENT_MODE=manual` separa los medios de pago de una pasarela. QR, Bre-B, transferencia y consignación generan reportes `AWAITING_VERIFICATION`; solo administración puede confirmarlos. Los comprobantes son privados y cada transición conserva auditoría.

`PAYMENT_MODE=mock` permite simular el ciclo únicamente en local. La API bloquea la aprobación mock con `NODE_ENV=production` y el despliegue valida la configuración antes de promover.

### Wompi

`PAYMENT_MODE=gateway` con `PAYMENT_GATEWAY=wompi` crea la URL de Checkout Web con referencia única, monto en centavos COP y firma de integridad SHA-256. El estado definitivo de la factura cambia desde el webhook firmado, validando dinámicamente las propiedades que envía el evento, su timestamp y `WOMPI_EVENTS_SECRET`.

## Seguimiento

Las decisiones de experiencia y los recorridos verificados se registran en la [memoria del proyecto](MEMORIA_PROYECTO.md), el [SDD de movimiento](SDD_UX_MOTION.md) y la [ficha de portada y catálogos](PORTADA_EDITORIAL_DEV.md).

### Activos de marca y visibilidad

`BrandLogo` usa los contornos trazados del PNG de JB en la cabecera y el SVG de la firma completa en el pie. `BrandIcon` comparte con los SVG descargables los contornos de las dos series del manual. El generador `scripts/generate-brand-assets.mjs` produce variantes y favicon desde un único juego de trazados. Los tokens de `brand.css` se aplican al layout global. El shader y las ilustraciones que se muestran con movimiento reducido comparten la paleta. Las fuentes variables locales se declaran en `app/layout.tsx`. [Identidad visual JB](IDENTIDAD_JB.md)

## Indicadores y contenido editorial compartido

La escena de Bogotá se monta una vez en el layout raíz. La navegación pública y la administrativa colocan la franja de presencia e indicadores sobre la escena. El panel IA embebido hereda la cabecera de la página que lo contiene. La iluminación del puntero, las fotografías del inventario y el pin guardado siguen perteneciendo a sus respectivos componentes.

| Módulo | Fuente y comportamiento |
| --- | --- |
| `FinancialTicker` y `/api/mercados` | Next consulta cinco símbolos fijos de Yahoo Finance. Cada proceso agrupa solicitudes concurrentes y reutiliza la respuesta durante 120 segundos. El navegador consulta el mismo origen mientras la pestaña está visible. Los últimos precios llevan la fecha del mercado. Un fallo individual conserva su último valor comprobado, si existe, y se identifica en la interfaz. |
| Variación diaria | Se calcula contra el último cierre válido de una sesión anterior en la zona horaria de la bolsa. La fuente puede tener demora. Los enlaces abren cada instrumento con su símbolo original. USD/COP corresponde al mercado de divisas, Brent al contrato de futuros y CIB y AVAL a ADR cotizados en USD. |
| `LocationRotator` y `WorldClocks` | GSAP rota las ubicaciones cada tres segundos. Un control detiene o reanuda la cinta y las ciudades. Con movimiento reducido los detalles permiten leer las listas completas. Luxon convierte un solo instante a cuatro zonas IANA. Los relojes actualizan los segundos y la fecha al cambiar de día. |
| Contenido del sitio | El esquema compartido define las imágenes, descripciones, títulos, vínculos, ciudades y zonas horarias. La acción exige rol ADMIN, carga las imágenes mediante el servicio de archivos y publica la sección con su revisión. El caché de lectura identifica la API del entorno. Una publicación invalida la etiqueta de contenido. |
| Imágenes | Los tres perfiles tienen foto e introducción propias. Arrendatarios comparte su foto entre portada, portal y cuenta. El bloque de alianzas tiene imagen, texto, descripción y destino propios. Las fotografías editoriales de respaldo se distribuyen como WebP locales. Las fotografías del inventario, contratos y comprobantes conservan los flujos de acceso de sus módulos. |

Las dos fotos creadas para la entrega representan una entrega de llaves y una reunión sobre una maqueta. La sección invita a presentar propuestas. Los precios, saldos y estados de pago siguen procediendo de las fuentes de negocio. Los componentes visuales y los activos se registran en `.21st/design.json`.

## Consulta jurídica colombiana

La nube usa un diálogo nativo y Motion; `/consulta-juridica` comparte el contexto de marca. La acción de Next llama con la sesión del usuario a Nest. `LegalController` controla el acceso y la frecuencia. `consultColombianLaw` llama a OpenAI Responses con `store: false`, búsqueda restringida a dominios oficiales y verificación de los enlaces devueltos. El servidor recibe `OPENAI_API_KEY` y, opcionalmente, `OPENAI_MODEL`. En DEV la API acepta también el Secret opcional `jb-openai` del namespace. El recorrido externo abre ChatGPT con un contexto fijo; el usuario introduce allí su consulta.
