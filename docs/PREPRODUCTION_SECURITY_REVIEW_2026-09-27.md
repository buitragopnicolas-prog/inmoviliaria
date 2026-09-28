# Revisión de seguridad previa a producción

Fecha: 2026-09-27  
Rama de trabajo: `codex/preproduction-security-audit`  
Alcance: aplicación, dependencias, imágenes, CI y manifiestos. El despliegue autorizado se limita a DEV.

## Hallazgo crítico corregido

El registro público vinculaba automáticamente una cuenta nueva con un arrendatario existente usando únicamente la coincidencia del correo. Una persona que conociera ese correo podía registrar primero la cuenta y obtener acceso a contratos, facturas y pagos asociados.

La corrección deshabilita el registro público en DEV y producción tanto en la API como en la interfaz. Sólo puede usarse en un entorno declarado `local`. La creación segura de nuevas cuentas para clientes queda pendiente de un flujo de invitación con token de un solo uso o verificación de correo antes de habilitarse en entornos compartidos.

## Controles aplicados

- Sesiones reducidas de 24 horas a 1 hora; producción rechaza valores superiores.
- Cada solicitud autenticada revalida en la base de datos la existencia del usuario y su rol actual. La eliminación o cambio de rol deja de depender de que venza el JWT anterior.
- La carpeta estática queda limitada a `/uploads/seed`; contratos, comprobantes y futuras cargas locales no pueden publicarse por accidente desde `/uploads`.
- API y web usan filesystem raíz de solo lectura en Kubernetes, con volúmenes temporales explícitos.
- Se agregaron encabezados COOP, CORP y desactivación de DNS prefetch, además de los controles existentes.
- Las imágenes Node y PostgreSQL se fijaron por digest; GitHub Actions se fijaron por SHA y el runner por versión de Ubuntu.
- Se añadieron pruebas para la política de registro, revalidación de identidad y límite de sesión.

## Riesgos abiertos antes de producción

| Severidad | Riesgo | Tratamiento requerido |
|---|---|---|
| Moderada | La integración n8n usa API key pero no firma con timestamp, nonce y protección contra replay. | Implementar firma del sobre antes de automatizar decisiones financieras sin revisión humana. |
| Moderada | El rate limit se guarda en memoria por instancia. | Usar un backend compartido antes de escalar a varias réplicas. |
| Moderada | La CSP de Next todavía requiere `unsafe-inline`. | Migrar scripts y estilos compatibles a nonce/hash en una fase controlada. |
| Moderada | `npm audit` informa cuatro avisos transitivos del SDK MinIO; no existe una actualización compatible que los elimine. | Mantener límites de entrada, monitorear una versión corregida y no aplicar el downgrade forzado propuesto por npm. |
| Moderada | No existen refresh tokens rotatorios, MFA ni panel de revocación de sesiones. | Diseñar sesión revocable antes de ampliar perfiles administrativos o exposición pública. |
| Baja | Falta correlación por request ID y redacción centralizada de logs. | Incorporar observabilidad antes de producción. |

## Evidencia local

- TypeScript API/web: PASS.
- Build API y Next de producción: PASS.
- Pagos, archivos, configuración y autenticación: 35/35 PASS.
- Regresiones de frontend y política de pagos: 24/24 PASS.
- Manejo de errores web: 10/10 PASS.
- Manifiestos Kubernetes DEV/PROD: renderizados correctamente.
- Imágenes API y web: construidas correctamente con bases fijadas por digest.
- Imagen web con filesystem raíz de solo lectura: página principal HTTP 200, `/registro` HTTP 404 y encabezados COOP/CORP presentes.
- Dependencias: 0 críticas, 0 altas, 4 moderadas, 0 bajas.
- Secretos de alto riesgo en archivos versionados: no detectados.

Producción permanece bloqueada por la compuerta de pagos existente y por los riesgos abiertos indicados. La validación en DEV debe confirmar disponibilidad, autenticación de cuentas existentes, rechazo del registro y salud de API/web antes de considerar una revisión de promoción.
