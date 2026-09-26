# Asesoría Inmobiliaria JB — Next.js SSR + NestJS + Prisma 7

Plataforma web para publicar inmuebles en arriendo, recibir contactos, administrar galerías fotográficas y permitir que los arrendatarios consulten y paguen facturas.

## Incluye

- **Frontend SSR** con Next.js 16 App Router y Server Components.
- **Backend REST** con NestJS 11, JWT y control de acceso `ADMIN` / `USER`.
- **Prisma ORM 7** con PostgreSQL, `prisma.config.ts`, cliente generado y `@prisma/adapter-pg`.
- Catálogo público, ficha del inmueble y formulario de contacto.
- Ficha del inmueble con galería, foto 360 cargada en MinIO y video.
- Panel administrativo: indicadores, publicación de inmuebles con múltiples fotografías, mensajes y facturas.
- Cuenta del usuario: contratos, facturas pagadas/pendientes y pago.
- Pago local `mock` para desarrollo e integración preparada con **Wompi Checkout Web** y webhook verificado.
- Docker Compose para frontend, API, PostgreSQL y MinIO.
- Storage S3-compatible con MinIO y ruta pública estable vía API para archivos e imágenes.

## Preparación actual de local, dev y producción

Consulte [la guía de arranque y despliegues](docs/LOCAL_Y_DESPLIEGUES.md). Incluye el script Windows, los overlays Kubernetes y el despliegue con migraciones previas.

## Inicio rápido con Docker

1. Copie las variables de entorno:

```bash
cp .env.example .env
```

2. Inicie todo el entorno:

```bash
docker compose up --build
```

Si `5432`, `4000`, `3000`, `9000` o `9001` ya estan en uso en su equipo, ajuste `POSTGRES_HOST_PORT`, `API_HOST_PORT`, `WEB_HOST_PORT`, `MINIO_API_HOST_PORT`, `MINIO_CONSOLE_HOST_PORT` y las URLs relacionadas en `.env` antes de iniciar.

3. Abra:

- Sitio: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Consola MinIO: `http://localhost:9001`

### Usuarios iniciales

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@asesoriainmobiliariajb.com` | `Admin123*` |
| Arrendatario | `cliente@asesoriainmobiliariajb.com` | `Cliente123*` |

Cambie estas credenciales y `JWT_SECRET` antes de cualquier despliegue real.

## Ejecución local sin Docker

Requiere Node.js 22 y PostgreSQL disponible.

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Si ejecuta el backend sin Docker, debe tener un storage S3-compatible disponible. Para MinIO local use `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` y `STORAGE_BUCKET`. Para un storage externo futuro en InterServer u otro proveedor S3-compatible, solo cambie esas variables y, si aplica, `STORAGE_USE_SSL=true`.

## Módulos funcionales

### Sitio público

- Inicio con propiedades destacadas.
- Catálogo filtrable de inmuebles disponibles.
- Detalle de inmueble con galería, características y solicitud de información.
- Integración opcional de foto 360 cargada desde MinIO y video por inmueble.
- Formulario de contacto.

### Panel administrativo

Ruta: `/admin`

- Dashboard con total de inmuebles publicados, facturas pendientes, pagos recaudados y contactos nuevos.
- Gestión de inmuebles con carga de hasta 10 imágenes por publicación.
- Carga y publicación de archivos genéricos desde `/admin/archivos`.
- Consulta de contactos recibidos.
- Consulta y generación de facturas asociadas a contratos.

## Storage de archivos

- Las imágenes nuevas de inmuebles y los archivos genéricos se guardan en MinIO.
- El acceso público a archivos se hace por rutas del API (`/api/files/:id/content`), por lo que el frontend no depende del host del bucket.
- Para un proveedor externo S3-compatible en el futuro, cambie `STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_USE_SSL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` y `STORAGE_BUCKET`.
- Si el bucket ya existe y no desea que la app lo cree, use `STORAGE_AUTO_CREATE_BUCKET=false`.

### Cuenta del arrendatario

Ruta: `/mi-cuenta`

- Lista de facturas y estado de pago.
- Flujo de pago de una factura pendiente.
- En modo `manual`, medios configurados por el backend, reporte del pago y verificación administrativa.
- En modo `mock`, botón de confirmación exclusivo para desarrollo local.

## Integración de pagos

Para pagos reales fuera de la plataforma use:

```env
PAYMENT_MODE=manual
PAYMENT_GATEWAY=none
```

Los datos de QR, Bre-B y cuenta bancaria se configuran con `MANUAL_PAYMENT_*`; consulte `.env.example` y [la guía de pagos manuales](docs/PAGOS_MANUALES_Y_N8N.md). Si faltan datos autorizados, el medio permanece deshabilitado.

Para habilitar Cybervestigio con redirección automática de checkout, configure:

```env
PAYMENT_MODE=gateway
PAYMENT_GATEWAY=cybervestigio
CYBERVESTIGIO_CHECKOUT_URL=https://cybervestigio.com/pagos
CYBERVESTIGIO_RETURN_URL=https://su-dominio/mi-cuenta
```

También puede habilitar Wompi, configure llaves de sandbox o producción y cambie:

```env
PAYMENT_MODE=gateway
PAYMENT_GATEWAY=wompi
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_INTEGRITY_SECRET=test_integrity_...
WOMPI_EVENTS_SECRET=test_events_...
WOMPI_REDIRECT_URL=https://su-dominio/mi-cuenta
```

Configure como webhook público HTTPS:

```text
POST https://su-api/api/payments/wompi/webhook
```

El backend valida el checksum dinámicamente con las propiedades enviadas por Wompi antes de actualizar una factura.

## API principal

| Método | Endpoint | Acceso | Uso |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Público | Crear usuario arrendatario |
| POST | `/api/auth/login` | Público | Autenticación JWT |
| GET | `/api/properties` | Público | Consultar inmuebles publicados |
| GET | `/api/properties/:slug` | Público | Ver detalle |
| POST | `/api/contacts` | Público | Registrar contacto |
| GET | `/api/invoices/me` | Usuario | Facturas propias |
| POST | `/api/payments/invoices/:id/intent` | Usuario | Iniciar pago |
| GET | `/api/admin/dashboard` | Admin | Indicadores |
| POST | `/api/admin/properties` | Admin | Crear inmueble y subir fotos |
| GET | `/api/admin/files` | Admin | Listar archivos cargados |
| POST | `/api/admin/files` | Admin | Subir archivos genéricos |
| GET | `/api/files/:id/content` | Público | Abrir o descargar archivo |
| GET | `/api/admin/invoices` | Admin | Consultar facturas |
| GET | `/api/admin/users` | Admin | Listar usuarios, cartera e inmueble activo |
| GET | `/api/admin/users/:id` | Admin | Ver perfil, contratos, facturas y pagos |
| POST | `/api/admin/users/:id/assign-property` | Admin | Asignar inmueble y crear cobro inicial |

## Estructura

```text
apps/
  api/   NestJS + Prisma 7 + PostgreSQL + archivos subidos
  web/   Next.js SSR + Server Actions
```

## Consideraciones de producción

- Reemplazar credenciales por secretos gestionados y exponer MinIO o el proveedor S3-compatible detrás de red privada o TLS.
- Usar HTTPS, secreto JWT robusto y gestor de secretos.
- Mantener `PAYMENT_PROVIDER=wompi` únicamente con llaves protegidas.
- Configurar dominio del webhook en el dashboard del comercio y validar pagos desde el evento, no desde el navegador.

## n8n

El paquete de producción incluye un despliegue opcional de n8n para:

```text
https://n8n.asesoriainmobiliariajb.com
```

La instalación utiliza el mismo clúster y PostgreSQL, pero mantiene base de datos, Secret, Service, PVC e Ingress independientes. Consulte `INSTALAR_N8N.md`.

## Gestión de inmuebles

El módulo administrativo permite crear inmuebles sin fotografía —en ese caso utiliza una imagen predeterminada—, editar los datos y recursos multimedia, y asignar cada inmueble a un arrendatario existente o nuevo. Los arrendatarios importados desde datos históricos están disponibles en el selector de asignación.

## Administración de usuarios y cartera

El panel `/admin/usuarios` unifica los perfiles históricos con las cuentas registradas en la web. Desde allí el administrador puede:

- buscar usuarios por nombre, correo, documento o teléfono;
- consultar toda su información y si tiene cuenta de acceso web;
- asignar un inmueble disponible y crear el cobro del periodo actual;
- comprobar saldos pendientes, facturas vencidas y pagos aprobados;
- revisar el historial completo de contratos, facturas y pagos.

Cuando se asigna un inmueble, su estado cambia a `RENTED`, por lo que deja de mostrarse en el catálogo público de disponibles. Las cuentas nuevas se vinculan automáticamente con un perfil histórico cuando el correo coincide.
