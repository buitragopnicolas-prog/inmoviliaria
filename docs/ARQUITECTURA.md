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
                                      ├── /uploads (imágenes en desarrollo)
                                      └── Wompi Checkout / Webhook (configurable)
```

## Frontend: Next.js SSR

El frontend utiliza App Router, Server Components y Server Actions. Las páginas que dependen de datos consultan la API con `cache: 'no-store'`; el layout lee la sesión HTTP-only para mostrar navegación por rol. En consecuencia, el catálogo, la cuenta y el panel se renderizan en servidor por solicitud.

Rutas públicas:

- `/`: home con inmuebles destacados.
- `/inmuebles`: catálogo y filtros.
- `/inmuebles/[slug]`: ficha, galería y contacto.
- `/nosotros` y `/contacto`.
- `/login` y `/registro`.

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

## Fotografías

En desarrollo, NestJS procesa `multipart/form-data`, admite hasta 10 imágenes JPG/PNG/WEBP de máximo 5 MB por operación y sirve `/uploads` como contenido estático.

En producción se debe reemplazar el disco local por almacenamiento de objetos, reglas antivirus, CDN y URLs firmadas o públicas controladas.

## Pagos

### Modo local

`PAYMENT_MODE=manual` separa los medios de pago de una pasarela. QR, Bre-B, transferencia y consignación generan reportes `AWAITING_VERIFICATION`; solo administración puede confirmarlos. Los comprobantes son privados y cada transición conserva auditoría.

`PAYMENT_MODE=mock` permite simular el ciclo únicamente en local. La API bloquea la aprobación mock con `NODE_ENV=production` y el despliegue valida la configuración antes de promover.

### Wompi

`PAYMENT_MODE=gateway` con `PAYMENT_GATEWAY=wompi` crea la URL de Checkout Web con referencia única, monto en centavos COP y firma de integridad SHA-256. El estado definitivo de la factura cambia desde el webhook firmado, validando dinámicamente las propiedades que envía el evento, su timestamp y `WOMPI_EVENTS_SECRET`.

## Evolución recomendada

- Integrar contratos PDF, notificaciones de cobro y conciliación.
- Sustituir JWT de una sola duración por access/refresh token y rotación segura.
- Añadir pruebas unitarias/integración, auditoría de cambios y observabilidad.
- Integrar almacenamiento cloud y escaneo de archivos.
