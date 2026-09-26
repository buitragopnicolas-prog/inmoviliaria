# Contrato REST principal

Base local: `http://localhost:4000/api`

## Autenticación

### `POST /auth/login`

```json
{ "email": "cliente@asesoriainmobiliariajb.com", "password": "Cliente123*" }
```

Respuesta:

```json
{ "accessToken": "jwt", "user": { "sub": "...", "email": "...", "name": "...", "role": "USER" } }
```

En endpoints privados enviar `Authorization: Bearer <jwt>`.

## Inmuebles

- `GET /properties/featured`
- `GET /properties?search=chico&city=Bogotá&maxRent=4000000`
- `GET /properties/:slug`
- `GET /admin/properties` — administrador.
- `POST /admin/properties` — administrador, `multipart/form-data`; campo de archivos `photos`.
- `POST /admin/properties/:id/images` — administrador, añade fotos.
- `DELETE /admin/properties/:id` — administrador, archiva la publicación.

Campos del formulario administrativo: `title`, `description`, `monthlyRent`, `administrationFee`, `deposit`, `city`, `neighborhood`, `address`, `bedrooms`, `bathrooms`, `areaM2`, `parking`, `features`, `published`, `photos`.

Las fotos nuevas quedan publicadas bajo rutas del tipo `GET /files/:id/content`.

## Archivos

- `GET /admin/files` — administrador, lista archivos almacenados.
- `POST /admin/files` — administrador, `multipart/form-data`; campo de archivos `files`, campo opcional `folder`.
- `GET /files/:id` — público, devuelve metadatos del archivo.
- `GET /files/:id/content` — público, entrega el contenido.
- `GET /files/:id/content?download=1` — público, fuerza descarga.

Los uploads usan un backend S3-compatible, con MinIO por defecto en Docker Compose.

## Contactos

- `POST /contacts` — público.
- `GET /admin/contacts` — administrador.

## Facturación

- `GET /invoices/me` — usuario autenticado.
- `GET /invoices/me/:id` — usuario propietario de la factura.
- `GET /admin/invoices` — administrador.
- `POST /admin/invoices` — administrador.
- `GET /admin/leases` — administrador; contratos para generar factura.

## Pagos

- `POST /payments/invoices/:invoiceId/intent` — crea intento del usuario.
- `POST /payments/mock/:reference/approve` — únicamente modo local.
- `POST /payments/wompi/webhook` — evento público verificado con `X-Event-Checksum` o `signature.checksum`.
- `GET /payments/manual/config` — medios manuales autorizados para el usuario autenticado.
- `POST /payments/invoices/:invoiceId/manual-report` — reporta un pago manual propio con comprobante opcional.
- `GET /payments/manual/pending` — reportes pendientes para administración.
- `PATCH /payments/manual/:paymentId/review` — confirma, rechaza o pasa a revisión un reporte.
- `GET /payments/receipts/:fileId` — comprobante privado para titular o administrador.
