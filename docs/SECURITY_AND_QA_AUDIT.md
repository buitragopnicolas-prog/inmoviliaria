# Auditoría integral de seguridad y QA

Fecha: 2026-09-25  
Rama: `codex/manual-payment-lab`  
Punto inicial: `9e0048670ef18c6e43d4466d3752844dff617afe`  
Ámbito: repositorio y servicios locales. DEV y producción no fueron modificados.

## Dictamen

**READY FOR DEV REVIEW.** El laboratorio local quedó endurecido y validado con separación de privilegios para PostgreSQL y MinIO, cuarentena antimalware con fallo cerrado, migraciones, persistencia y E2E financiero concurrente. Este dictamen autoriza revisión; no constituye despliegue. DEV y producción permanecen intactos.

## Evidencia ejecutada

| Control | Resultado | Evidencia |
|---|---|---|
| Git | OK | rama y HEAD inicial registrados; producción intacta |
| TypeScript API/web | PASS | `npm run check` |
| Build API/web | PASS | Prisma generate, Nest build y Next production build |
| Pagos/config/archivos | PASS 31/31 | `npm run test:payments`, incluidos OK, FOUND, indisponibilidad y timeout de ClamAV |
| Manejo de errores web | PASS 10/10 | `npm run test:web-errors` |
| Regresiones JS sin loader TS | PASS 11/11 | filtros, fechas y compuerta de pagos |
| Suite `tsx` | PASS 24/24 | ejecutada con identidad local normal; el error `uv_os_get_passwd ENOMEM` quedó limitado al sandbox restringido |
| Laboratorio web | PASS parcial | HTTP 200 y cabeceras defensivas en `http://localhost:3000/laboratorio/pagos-manuales` |
| Docker Compose | PASS sintáctico | `docker compose config --quiet` |
| Kubernetes | PASS sintáctico | `kubectl kustomize` para infra DEV, app DEV y app PROD |
| Docker daemon | PASS con ejecución elevada | Docker Desktop 29.8.0, contexto `desktop-linux`; PostgreSQL y MinIO saludables |
| PostgreSQL/MinIO/migraciones | PASS | 11 migraciones aplicadas; rol runtime mínimo, privilegios futuros, política bucket-only y privacidad verificados |
| E2E financiero | PASS real | factura aislada, archivos hostiles, IDOR, idempotencia x10 y confirmación concurrente |
| E2E antimalware | PASS real | JPG/PNG/PDF limpios; EICAR bloqueado; caída del motor devuelve 503; INFECTED/SCAN_FAILED inaccesibles |
| Dependencias | 0 critical, 0 high, 4 moderate, 0 low | `npm audit --json` |
| Secretos | sin credenciales de alto riesgo detectadas | revisión de archivos versionados e historial; valores sensibles no se imprimieron |
| Restore | PASS local aislado | PostgreSQL: conteos `3,4,4,6,3`; MinIO: 6 objetos y bucket privado; temporales eliminados |

## Correcciones aplicadas

- Configuración de producción con fallo seguro: exige `APP_ENV`, base de datos, JWT robusto, origen HTTPS, storage no predeterminado, bucket precreado y modo de pagos válido.
- Límite global por IP y límites más estrictos para login, registro, contacto, reportes, revisión administrativa, webhooks y n8n.
- Comparación bcrypt constante con hash ficticio cuando el correo de login no existe.
- Validación server-side de extensión, MIME, tamaño, nombre y firma de JPG, PNG, WEBP y PDF.
- Metadatos públicos restringidos a imágenes de inmuebles y archivos genéricos; contratos y comprobantes quedan fuera.
- Comprobantes y contratos se sirven con `private, no-store`; archivos genéricos se fuerzan como descarga y todos usan `nosniff`.
- Referencias manuales normalizadas y únicas sin distinguir mayúsculas; una sola solicitud manual activa por factura.
- Decisión administrativa adquirida mediante actualización condicional y transacción serializable; una segunda decisión concurrente devuelve conflicto.
- Conflictos serializables Prisma `P2034` convertidos en HTTP 409 e idempotencia protegida durante la ventana entre consultas concurrentes.
- Constraints para monto positivo, COP, referencia normalizada y transiciones de auditoría.
- Auditoría financiera append-only mediante trigger que impide `UPDATE` y `DELETE`.
- Readiness verifica PostgreSQL y el bucket de almacenamiento.
- Contenedores API/web y pods configurados como usuario no root, sin escalada de privilegios, sin capabilities y con seccomp.
- n8n retirado de la política de acceso directo a PostgreSQL de la aplicación.
- CSP, anti-framing, `nosniff`, referrer policy, permissions policy y HSTS en producción.
- Límites de longitud, cantidad y valor incorporados en inputs financieros, integración, usuarios, noticias e inmuebles.
- Passwords de demostración eliminados de `.env.example` y de ejemplos HTTP.
- PostgreSQL separa el rol administrador/migrador del rol runtime `inmobiliaria_app`; este último no es superusuario y no crea bases, roles, tablas ni replicación.
- MinIO separa root de `inmobiliaria-app`; la política runtime permite únicamente listar el bucket de la aplicación y leer, escribir o eliminar objetos dentro de él.
- Todo archivo nuevo entra a `quarantine/`, conserva un registro `PENDING_SCAN` y solo se promueve si ClamAV responde `CLEAN`.
- Estados `INFECTED` y `SCAN_FAILED` conservan trazabilidad, permanecen en cuarentena y se excluyen de listados y descargas.
- ClamAV 1.4.6 está fijado por digest, sin puertos de host, con firmas persistentes, healthcheck, `no-new-privileges` y capacidades reducidas.

## Seguridad por área

### Autenticación y sesión

Login responde un mensaje genérico y ahora evita la diferencia evidente de tiempo para usuarios inexistentes. El frontend guarda el JWT en cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción y no lo expone a JavaScript. La API recibe Bearer tokens enviados por Server Actions.

Riesgo abierto: no existen refresh tokens, revocación, listado de sesiones, recuperación de contraseña ni MFA. El logout elimina la cookie, pero un JWT robado puede reutilizarse hasta expirar (24 horas por defecto). Para producción se recomienda un identificador de sesión revocable o JWT de vida corta con refresh rotatorio.

### Autorización e IDOR

Los controladores administrativos usan JWT y rol `ADMIN`. Facturas y contratos del usuario filtran por `userId`. Los comprobantes permiten acceso únicamente al propietario o a un administrador y devuelven 404 en accesos no autorizados. El E2E creó un segundo usuario y confirmó 404 para factura y comprobante ajenos, además de 403 para la bandeja administrativa.

### CSRF, CORS y XSS

CORS usa un origen explícito y credentials; no usa `*`. La cookie HttpOnly no se reenvía directamente a la API: las mutaciones pasan por Server Actions, con `SameSite=Lax` y las verificaciones de origen de Next. El riesgo CSRF se considera mitigado para la arquitectura actual. La CSP reduce ejecución e inclusión no autorizadas; `unsafe-inline` permanece por compatibilidad con Next y debe reducirse con nonces en una fase posterior.

### Pagos, replay e idempotencia

El servidor deriva el saldo de la factura, exige valor exacto, fecha no futura, método habilitado, idempotency key persistida y referencia bancaria única. La confirmación requiere `ADMIN`; no cambia el saldo ante el reporte. La migración agrega unicidad parcial y checks. El E2E real envió diez reportes simultáneos y obtuvo un solo pago; dos confirmaciones simultáneas produjeron un éxito y un 409 controlado.

### Archivos, MinIO y antimalware

Los objetos usan UUID y prefijos saneados. El bucket local es privado y el usuario runtime carece de permisos administrativos o acceso a otros buckets. La firma de archivo evita confiar solo en extensión/MIME. El flujo ejecutado es `UPLOAD -> QUARANTINE -> SCAN -> CLEAN/INFECTED/SCAN_FAILED`; solo `CLEAN` pasa a su prefijo definitivo y puede listarse o descargarse. EICAR se detectó realmente, la caída del motor produjo 503 y los registros bloqueados devolvieron 404 al intentar servirlos.

### n8n y correo bancario

Los endpoints usan API key con comparación constante, remitentes permitidos y IDs únicos. La política de red ya no permite acceso directo de n8n a PostgreSQL. Falta un sobre firmado con timestamp, nonce, expiración, scope y rotación; el contenido de correo debe mantenerse como dato no confiable y cualquier confirmación financiera debe requerir decisión humana.

### Logs y errores

No se observaron logs de passwords, JWT, cookies o cuerpos de comprobantes. Los errores públicos de Nest no exponen SQL o stack en modo normal. El log de borrado de objetos incluye una key aleatoria, no el contenido. Se recomienda redacción centralizada y correlación por request ID antes de producción.

## Migraciones 202609250001, 202609250002 y 202609250003

La primera agrega enums, columnas nullable, índices, relaciones y la tabla de auditoría sin reescribir valores históricos. La segunda crea constraints e índices concurrentes funcionales. La tercera agrega el estado y la evidencia de escaneo; marca los objetos históricos como `CLEAN` con motor `legacy-trusted` y deja `PENDING_SCAN` como valor predeterminado para cargas futuras. No elimina columnas ni datos.

Antes de aplicarlas se deben ejecutar en una copia restaurada estas precondiciones:

```sql
SELECT "invoiceId", count(*) FROM "Payment"
WHERE "provider"='MANUAL' AND "status" IN ('AWAITING_VERIFICATION','UNDER_REVIEW')
GROUP BY "invoiceId" HAVING count(*) > 1;

SELECT upper("bankReference"), count(*) FROM "Payment"
WHERE "provider"='MANUAL' AND "bankReference" IS NOT NULL
GROUP BY upper("bankReference") HAVING count(*) > 1;

SELECT count(*) FROM "Payment" WHERE "amount" <= 0 OR "currency" <> 'COP';
SELECT count(*) FROM "Payment" WHERE "provider"='MANUAL' AND "bankReference" IS NOT NULL
AND "bankReference" <> upper("bankReference");
```

Cualquier resultado distinto de cero bloquea la migración y exige saneamiento auditado. PostgreSQL no ofrece `down` automático para estas migraciones; la reversión segura es restaurar el backup verificado o preparar una migración compensatoria. No se debe intentar remover valores de enum en caliente.

## Dependencias

| Paquete | Advisory | Riesgo en este proyecto | Acción |
|---|---|---|---|
| `decode-uri-component@0.2.2` | GHSA-vcc3-ghjq-m6fr | DoS por entrada percent-encoded malformada a través de `query-string`; transitivo de MinIO | Moderado; límites y uso controlado reducen exposición. Sin upgrade seguro del SDK disponible. |
| `query-string@7.1.3` | transitivo | Hereda el advisory anterior | Monitorear release de MinIO; no forzar override sin compatibilidad. |
| `stream-json@1.9.1` | GHSA-528h-pc64-c93x | Complejidad O(depth²); vector local en parsing del SDK | Moderado; no se procesan JSON arbitrarios con esa API directamente. Actualizar cuando MinIO publique versión compatible. |
| `minio@8.0.7` | agregado | Dependencia directa que incorpora los transitivos | `npm audit fix` propone downgrade mayor a 7.1.3; se rechazó por riesgo funcional y porque no es una corrección segura. |

## Inventario de endpoints

Todos los DTO pasan por whitelist, rechazo de propiedades desconocidas y transformación global.

| Grupo/rutas | Auth/rol | Rate limit | Sensibilidad |
|---|---|---|---|
| `GET /health/live`, `GET /health/ready` | público | global | estado de servicio, sin detalles internos |
| `POST /auth/register`, `POST /auth/login` | público | 3/h, 5/min | credenciales/PII |
| `GET /auth/me` | JWT | global | identidad propia |
| `POST /contacts` | público | 5/h | PII/mensaje |
| `GET /admin/contacts` | JWT ADMIN | global | PII |
| `GET /properties`, `/featured`, `/:slug` | público | global | catálogo |
| `/admin/properties/**` | JWT ADMIN | global | inmuebles, imágenes, asignación |
| `GET /news/**` | público | global | contenido |
| `/admin/news/**` | JWT ADMIN | global | publicación |
| `GET /files/:id`, `GET /files/:id/content` | público, solo propósito permitido | global | archivos públicos controlados |
| `/admin/files/**` | JWT ADMIN | global | carga/listado |
| `GET /leases/me`, `GET /leases/:id/contract` | JWT y propiedad | global | contratos privados |
| `/admin/leases/**` | JWT ADMIN | global | contratos/PII |
| `GET /invoices/me/**` | JWT y propiedad | global | facturación propia |
| `/admin/invoices/**` | JWT ADMIN | global | facturación completa |
| `/admin/users/**`, `/admin/tenants`, `/admin/dashboard` | JWT ADMIN | global | PII/operación |
| `POST /payments/invoices/:id/intent` | JWT y propiedad | global | pago |
| `GET /payments/manual/config` | JWT | global | datos bancarios públicos autorizados |
| `POST /payments/invoices/:id/manual-report` | JWT y propiedad | 10/min | pago/comprobante |
| `GET /payments/manual/pending` | JWT ADMIN | global | pagos/PII |
| `PATCH /payments/manual/:id/review` | JWT ADMIN | 30/min | decisión financiera |
| `GET /payments/receipts/:id` | JWT propietario o ADMIN | global | comprobante privado |
| `POST /payments/mock/:ref/approve` | JWT propietario; solo mock local | 10/min | simulación |
| `POST /payments/wompi/webhook` | firma Wompi | 60/min | evento financiero |
| `/integrations/n8n/bancolombia/**`, `/n8n/arrendamientos/**` | API key n8n | 60/min | conciliación bancaria |
| `/admin/reconciliation/**` | JWT ADMIN | global | conciliación/PII |

El límite global es 120 solicitudes por 60 segundos por instancia. Si se escala a varias réplicas debe migrarse a almacenamiento compartido para que el límite sea efectivo en todo el clúster.

## Matriz de configuración

| Variable/grupo | LOCAL | DEV | PROD | Requerida/secreta | Validación |
|---|---|---|---|---|---|
| `APP_ENV` | `local` | `development` | `production` | sí/no | enum; obligatoria con NODE_ENV production |
| `DATABASE_URL` | rol runtime local | secret runtime DEV | secret runtime PROD | sí/sí | mínimo privilegio probado localmente |
| `DATABASE_MIGRATION_URL` | rol migrador local | secret migrador DEV | secret migrador PROD | sí/sí | usada solo por Prisma migrate/seed |
| `JWT_SECRET` | local único | secret DEV | secret PROD | sí/sí | mínimo 32 en PROD; default bloqueado |
| `WEB_ORIGIN` | localhost | HTTPS DEV | HTTPS PROD | sí/no | HTTPS obligatorio en PROD |
| `MINIO_ROOT_*`, `MINIO_APP_*`, `STORAGE_*` | separados en local | secrets separados DEV | secrets separados PROD | sí/sí | runtime bucket-only; root solo inicialización |
| `ANTIMALWARE_*` | ClamAV interno | definir tras revisión | definir tras revisión | sí/parcial | fallo cerrado, timeout 15 s, sin puerto de host |
| `PAYMENT_MODE` | manual/mock | manual o gateway de prueba | manual/gateway real | sí/no | mock bloqueado en PROD |
| `PAYMENT_GATEWAY`, `WOMPI_*` | opcional | según prueba | según proveedor | condicional/sí | llaves completas si Wompi |
| `MANUAL_PAYMENT_*` | datos de laboratorio | datos autorizados DEV | datos autorizados PROD | condicional/sensible | al menos un método completo |
| `N8N_PAYMENTS_API_KEY` | opcional | secret DEV | secret PROD | si se habilita/sí | presencia y comparación constante |
| `BANCOLOMBIA_ALLOWED_SENDERS` | prueba | allowlist DEV | allowlist PROD | si se habilita/no | validada por servicio |
| `RATE_LIMIT_*` | defaults | explícitas | explícitas | sí/no | enteros; backend compartido pendiente al escalar |
| credenciales seed | solo local | prohibidas | prohibidas | local/sí | valores vacíos en ejemplo |

La base Kubernetes conserva `PAYMENT_PROVIDER=mock`; con `APP_ENV=production` la API ahora falla cerrada. Debe definirse una estrategia de pagos autorizada antes de cualquier promoción de producción.

## Hallazgos abiertos

### Alto

No quedan hallazgos altos abiertos en el alcance local auditado.

### Moderado

1. Cuatro advisories npm moderados: `decode-uri-component` (GHSA-vcc3-ghjq-m6fr), `query-string` por tránsito, `stream-json` (GHSA-528h-pc64-c93x) y el agregado directo `minio@8.0.7`. No existe actualización segura disponible; `npm audit fix --force` propone una regresión incompatible y no se aplicó.
2. JWT sin revocación, refresh rotatorio o MFA; logout no invalida un token robado.
3. n8n carece de firma con timestamp/nonce y scopes independientes.
4. Rate limit en memoria no es global entre réplicas.
5. CSP requiere `unsafe-inline`; falta adopción de nonce/hash.
6. Imágenes base y GitHub Actions usan tags mutables; falta pin por digest/SHA y política de actualización.
7. Registro revela que un correo existe; requiere decisión de producto y flujo de verificación para respuesta uniforme.

### Bajo

1. Falta request ID/redacción centralizada y métricas de seguridad.
2. No hay límites distribuidos ni bloqueo progresivo de cuenta; el límite por IP mitiga fuerza bruta básica.

## Procedimiento E2E local ejecutado

`npm run test:e2e:local` está restringido por código a `localhost`, `127.0.0.1` o `::1`. Requiere `E2E_CUSTOMER_EMAIL`, `E2E_CUSTOMER_PASSWORD`, `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD`. Verifica:

- usuario autenticado y factura propia con saldo;
- factura exclusiva creada y archivada por la prueba para no depender del saldo seed;
- usuario sin acceso a la bandeja administrativa;
- segundo usuario sin acceso a factura ni comprobante ajenos;
- rechazo real de HTML como JPG, EXE como PDF, MIME incorrecto, archivo vacío, PNG corrupto, doble extensión y archivo sobredimensionado;
- comprobante JPG válido y privado;
- diez reportes simultáneos con la misma idempotency key producen un solo pago;
- bandeja administrativa;
- dos confirmaciones simultáneas producen una sola decisión y un `409`;
- factura finalmente pagada.

La ejecución pasó contra PostgreSQL y MinIO locales. Modifica únicamente datos locales de prueba y archiva la factura creada al finalizar.

`npm run test:e2e:antimalware` también está restringido a localhost. Verifica tres formatos limpios, EICAR estándar, exclusión de listados y descarga. Con `E2E_EXPECT_SCANNER_DOWN=true` confirmó el fallo cerrado con HTTP 503. La base local conservó `INFECTED` y `SCAN_FAILED` en `quarantine/`; las rutas de contenido devolvieron 404.

## Recomendación para DEV

El código queda **READY FOR DEV REVIEW**. Antes de desplegar se deben crear secretos distintos para DEV, reproducir roles/políticas equivalentes sin copiar credenciales locales, acordar la aceptación temporal de los cuatro advisories npm y ejecutar backup verificable. La promoción sigue requiriendo autorización explícita. Producción requiere una autorización posterior e independiente.

