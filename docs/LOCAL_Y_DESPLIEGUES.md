# Local, desarrollo y producción

## Aislamiento

| Entorno | Ejecución | Datos | URL |
| --- | --- | --- | --- |
| Local | Node.js y Docker Desktop | Volúmenes Docker y `.env` local | `http://localhost:3000` |
| Dev | VPS, namespace `asesoria-inmobiliaria-dev` | PV y secretos propios en `/var/lib/asesoria-inmobiliaria-dev` | `https://dev.asesoriainmobiliariajb.com` |
| Producción | VPS, namespace `asesoria-inmobiliaria` | Volúmenes y secretos existentes | `https://asesoriainmobiliariajb.com` |

El código se comparte entre entornos mediante commits de `main`. Las bases de datos, buckets, secretos, imágenes web y cuentas de demostración son independientes. `.env.vps` contiene solo credenciales SSH de producción y está excluido de Git y Docker; nunca se carga como configuración de la aplicación ni en CI.

## Local

Abra Docker Desktop y ejecute desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

El script crea `.env` solo si falta, instala desde `package-lock.json`, inicia PostgreSQL y MinIO, aplica migraciones, carga datos de prueba y abre API y web en modo desarrollo. Use `-SkipInstall` si ya se ejecutó `npm ci`. Verifique `http://localhost:4000/api/health/ready` y `http://localhost:3000`. `npm run docker:down` conserva los datos.

Las contraseñas locales de prueba están en `.env.example`; sustitúyalas si el equipo es compartido. La carga inicial de prueba solo se ejecuta en local y, una única vez, en dev.

## Dev en el VPS

El clúster es de un solo nodo y no tiene StorageClass predeterminada. `k8s/infra/dev` crea PV estáticos, PVC y servicios exclusivos de dev. `scripts/bootstrap-dev-vps.sh` genera secretos aleatorios exclusivos de dev en `/root/asesoria-inmobiliaria-dev-secrets.env` con permisos 600. No copia secretos ni datos de producción.

El namespace, PostgreSQL, MinIO, migraciones y seed de dev están instalados. API y web ejecutan imágenes etiquetadas con el SHA completo del commit desplegado. La prueba `python3 scripts/smoke-dev-vps.py --upload` verificó salud, catálogo, web, login administrador y escritura/lectura de MinIO a través de Traefik.

El registro A `dev` apunta al VPS y responde en ambos DNS autoritativos de Hostinger. Nginx usa `k8s/nginx-dev-https.conf`, con un certificado Let's Encrypt propio de dev y redirección HTTP a HTTPS. Certbot renueva el certificado mediante el webroot `/var/www/html`. La web dev incorpora esa URL HTTPS al compilarse.

## CI/CD

Sonar es obligatorio para dev y producción. Consulte [la configuración de Sonar](SONAR.md) para iniciar el servidor local en Docker y configurar CI/VPS. El workflow espera el Quality Gate, y el VPS vuelve a comprobar la aprobación del SHA exacto antes de efectuar cambios. Sin Sonar accesible, sin análisis o con rechazo, no se despliega. Corrija los problemas y repita las pruebas y el análisis antes de volver a intentar el despliegue.

El job obligatorio `validate` ejecuta además `npm run test:e2e:ci` antes de ambos despliegues. Levanta API y web reales, PostgreSQL con base `inmobiliaria_ci`, MinIO privado y ClamAV real, todos desechables dentro del runner. Usa datos bancarios, usuarios y comprobantes sintéticos; no accede al VPS ni a secretos o datos de dev/producción. El E2E exige URLs HTTP de loopback, `CI=true` y esa base exclusiva.

La prueba reporta pagos por QR, Bre-B, transferencia y consignación, adjunta un PDF, verifica que el saldo siga pendiente y aprueba como administrador. Comprueba saldo cero, una sola aprobación, dos eventos de auditoría con actores correctos y comprobantes `CLEAN` de ClamAV. También envía los formularios web reales y abre su visor privado. Rechaza archivos falsos, EICAR, consultas de otros usuarios, aprobaciones sin rol y confirmaciones duplicadas/concurrentes. Verifica el límite real de diez reportes por minuto y espera su ventana antes de continuar; no eleva límites ni desactiva el antivirus o las autorizaciones para probar.

Si el E2E falla, `validate` falla y no se ejecuta ningún despliegue. GitHub conserva el resumen sintético `manual-payments-e2e-*` como artefacto durante siete días y elimina los servicios temporales incluso si hay fallos. Compilación, pruebas con cobertura, auditoría, migraciones, validaciones de manifiestos/imágenes, Sonar y las aprobaciones de producción se mantienen.

Tras reemplazar los contenedores, el smoke de dev permite hasta diez intentos de lectura ante HTTP 502/503/504 o fallos transitorios de conexión, con dos segundos entre intentos y timeout de diez segundos por petición. Los errores persistentes y las respuestas inválidas siguen bloqueando la verificación del SHA. No se repiten escrituras ni errores de aplicación o autorización.

`.github/workflows/pipeline.yml` valida cada PR y cada push a `main`: instalación limpia, compilación, tipos, migraciones/seed sobre PostgreSQL temporal, pruebas HTTP, render de Kubernetes e imágenes Docker. Un push a `main` que pasa CI despliega automáticamente en dev por SSH. El VPS obtiene exactamente el SHA de `main`, construye imágenes Linux locales, las importa a containerd, ejecuta migraciones, actualiza el namespace dev y comprueba las rutas web/API. Solo después guarda el SHA verificado.

El workflow manual de producción exige un SHA completo de `main`, vuelve a ejecutar CI y espera la aprobación del entorno `production` en GitHub. El VPS exige además que ese SHA sea el que está funcionando en dev y que coincida con `/root/asesoria-production-approved-sha`, creado únicamente tras la revisión explícita. El script detiene la promoción si siguen activos los pagos `mock`. Las llaves SSH de dev y producción son distintas y tienen comandos forzados para su entorno en `authorized_keys`; no permiten una shell libre.

El repositorio de CI/CD es `buitragopnicolas-prog/inmoviliaria`. GitHub tiene las variables `VPS_HOST` y `VPS_USER`, y cada entorno (`development` y `production`) tiene su propio secreto `VPS_SSH_KEY`. El entorno de producción exige la aprobación de `buitragopnicolas-prog`; ambos entornos admiten despliegues solo desde `main`. Las llaves privadas locales están excluidas de Git en `.local/inmo-actions-dev` y `.local/inmo-actions-prod`. `.github/known_hosts` fija la clave SSH del VPS. No copie las llaves privadas al repositorio.

## Condiciones para promover a producción

No se ha desplegado esta versión en producción. Para promover el mismo commit probado en dev se requieren: CI verde, aceptación funcional de dev por HTTPS, revisión de los avisos de `npm audit --audit-level=high`, pagos reales configurados, respaldo verificado de PostgreSQL y MinIO, aprobación humana del SHA y aprobación del entorno GitHub. La auditoría actual tiene 4 avisos moderados y ninguno alto; la compuerta de producción falla si aparece un aviso alto. El ConfigMap selecciona `PAYMENT_MODE=manual` y `PAYMENT_GATEWAY=none`. Antes de promoverlo deben configurarse `MANUAL_PAYMENT_BANK_NAME`, `MANUAL_PAYMENT_ACCOUNT_HOLDER` y al menos un medio autorizado: cuenta (tipo y número que se mostrará), llave Bre-B (tipo y valor) o URL pública del QR. Estos datos se muestran a los clientes y deben ser autorizados por el titular. Sin un medio completo, tanto la validación del despliegue como el inicio de la API bloquean producción. La producción actual sigue con su imagen anterior.

No ejecute `db:seed` en producción. Una migración de esquema puede requerir un plan propio para revertirla; `kubectl rollout undo` solo revierte contenedores. La primera creación de una cuenta administradora en una base de producción nueva requiere un proceso separado que no cargue datos de demostración.

Los datos autorizados de los medios manuales se guardan exclusivamente en `/etc/asesoria-inmobiliaria/manual-payments.json` en el VPS, propiedad de root y permisos 600; no se publican en el repositorio. Este archivo es un parche ConfigMap limitado a variables de pagos manuales. El QR original se conserva en `/opt/asesoria-inmobiliaria/payments/bancolombia-breb.jpeg`, servido por HTTPS en `/payments/bancolombia-breb.jpeg`. No se modifica la imagen ni se generan códigos nuevos. El VPS combina el parche con el manifiesto antes de validar los pagos y el smoke de dev comprueba los medios habilitados y la descarga del QR. Producción exige que la huella de los datos y del QR coincida con la verificada en dev, además del mismo SHA de código. Reportar un comprobante deja el pago pendiente de revisión administrativa; no confirma el pago ni modifica por sí solo el saldo.

El despliegue por SSH utiliza `scripts/vps-ssh-entry.sh` y `scripts/deploy-vps.sh`. Revise su salida y las pruebas de dev antes de cualquier aprobación de producción. Los antiguos comandos de `DEPLOY_KUBERNETES.md` documentan la instalación original y no deben usarse para esta promoción.

## Prueba obligatoria después de desplegar producción

El job `deploy-prod` solicita por la llave SSH restringida `SHA production-backup-e2e`. El comando forzado vuelve a comprobar Sonar para ese SHA y mantiene el bloqueo de despliegue durante respaldo, rollout y E2E. La versión nueva del comando forzado debe instalarse en `/usr/local/sbin/inmo-ssh-entry` desde un commit revisado y aprobado por Sonar. Las versiones anteriores rechazan el nuevo comando antes de desplegar; la nueva rechaza los protocolos y releases que no incluyen respaldo y E2E obligatorios. Dev conserva su comando y validaciones.

La prueba comprueba las imágenes API/web del SHA, vuelve a verificar Sonar y usa la web HTTPS de producción. Genera cuentas aleatorias con contraseñas que permanecen en memoria, un inmueble sin publicar, un contrato inactivo y una factura sintética de $100. Envía el formulario de reporte con un PDF marcado como prueba, verifica ClamAV y el visor privado, y aprueba únicamente ese pago desde el formulario de administrador. Comprueba factura pagada, saldo cero, auditoría, idempotencia y rechazo de accesos sin permiso o aprobaciones repetidas.

Incluso ante fallos, anula exclusivamente su pago con un nuevo evento de auditoría, archiva su factura y desactiva las cuentas temporales. Los actores y eventos originales se conservan porque la auditoría es inmutable. Elimina el comprobante sintético y verifica que las sesiones ya no sean válidas. Compara las huellas de los registros preexistentes sin restaurar ni revertir actividad ajena; cualquier diferencia exige revisión y marca el job como fallido. Si la consulta de facturas actualizaría vencimientos existentes, detiene la prueba antes de crear datos.

El ejecutor conserva evidencia privada, propiedad de root, en `/var/lib/asesoria-inmobiliaria-production/payment-probes`. Ante una interrupción intenta el cierre de ese mismo identificador, sin repetir el reporte ni la aprobación. Un fallo del flujo, del cierre o de integridad mantiene el despliegue fallido aunque la recuperación consiga cerrar los datos. El marcador `verified-sha` se escribe únicamente tras aprobar el E2E. No se cambian credenciales reales ni se ejecutan seeds, transferencias bancarias o restauraciones sobre producción.

Antes de desplegar, CI ejecuta la misma prueba contra la base y servicios desechables, incluyendo un fallo deliberado después de reportar para demostrar que el pago se anula y las cuentas se desactivan. Guarda ambos resultados junto al artefacto del E2E previo. Sonar, las validaciones anteriores y la aprobación humana de producción siguen siendo obligatorios.

## Respaldo automático antes de cada despliegue de producción

Después de comprobar Sonar, `scripts/production-release.sh` crea un respaldo nuevo mediante `scripts/backup-production.py create SHA`, antes de llamar al despliegue. No reutiliza respaldos anteriores ante un fallo. El script de despliegue exige el recibo privado de esa invocación mediante `INMO_PRODUCTION_BACKUP_RECEIPT` y verifica nuevamente su SHA, antigüedad, resultados de restauración e integridad antes de construir imágenes o aplicar migraciones/configuración. Si falta, está corrupto, pertenece a otro commit o tiene más de una hora, el despliegue falla. Si falla el respaldo, su restauración o su cierre, no se llega a desplegar ni a ejecutar el E2E de producción.

Los respaldos quedan en `/root/backups/production/SHA-*/`, con directorios 700 y archivos privados. Incluyen el dump PostgreSQL, el volumen MinIO, recursos Kubernetes —incluidos secretos— y la configuración protegida de pagos y el QR original. No se descargan ni se publican como artefactos de GitHub. Los diagnósticos detallados se conservan en ese directorio privado. Los respaldos y sus sumas de integridad permanecen disponibles; no se eliminan automáticamente respaldos anteriores.

La verificación restaura realmente PostgreSQL en una base nueva de nombre aleatorio, comprueba que puede consultar usuarios, facturas, pagos, archivos y migraciones, y elimina únicamente esa base temporal. Nunca restaura sobre la base activa. MinIO se extrae en un directorio temporal privado, rechaza rutas fuera del directorio, enlaces y archivos especiales, y compara las huellas de todos sus archivos. También exige que el inventario del volumen no cambie durante la ventana del respaldo; si hay escrituras concurrentes que lo alteren, el respaldo falla y debe repetirse. No se detiene el servicio ni se revierten operaciones reales para conseguir un respaldo válido.

Solo al terminar ambas restauraciones se escribe `verified.json`, ligado al SHA y al índice de sumas SHA256. Un fallo deja evidencia de error y nunca deja un recibo utilizable. Los bloqueos del VPS serializan la operación con los despliegues; el comando forzado impide omitir este paso desde Actions. El E2E de pagos sigue siendo obligatorio después del rollout y solo él marca la versión como verificada.

CI prueba la restauración usando el mismo cliente PostgreSQL 17 del contenedor de servicio y la base exclusiva `inmobiliaria_ci`, además de un volumen de archivos sintéticos. Las pruebas de fallo comprueban que corrupción, cambios en MinIO, errores de PostgreSQL, falta de espacio y errores de verificación impiden el despliegue. El protocolo SSH nuevo exige actualizar el guard protegido del VPS después de CI, Sonar y dev; instalarlo no promueve por sí mismo una nueva versión a producción. La autorización humana del SHA y del entorno `production` se conserva; el respaldo previo deja de depender de ejecutarlo manualmente.
