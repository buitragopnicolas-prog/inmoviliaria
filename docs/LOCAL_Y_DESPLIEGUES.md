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

`.github/workflows/pipeline.yml` valida cada PR y cada push a `main`: instalación limpia, compilación, tipos, migraciones/seed sobre PostgreSQL temporal, pruebas HTTP, render de Kubernetes e imágenes Docker. Un push a `main` que pasa CI despliega automáticamente en dev por SSH. El VPS obtiene exactamente el SHA de `main`, construye imágenes Linux locales, las importa a containerd, ejecuta migraciones, actualiza el namespace dev y comprueba las rutas web/API. Solo después guarda el SHA verificado.

El workflow manual de producción exige un SHA completo de `main`, vuelve a ejecutar CI y espera la aprobación del entorno `production` en GitHub. El VPS exige además que ese SHA sea el que está funcionando en dev y que coincida con `/root/asesoria-production-approved-sha`, creado únicamente tras la revisión explícita. El script detiene la promoción si siguen activos los pagos `mock`. Las llaves SSH de dev y producción son distintas y tienen comandos forzados para su entorno en `authorized_keys`; no permiten una shell libre.

Para activar Actions en GitHub faltan las variables de repositorio `VPS_HOST` y `VPS_USER`, y el secreto `VPS_SSH_KEY` en cada entorno `development` y `production`. Los archivos privados de las llaves están solo en `.local/inmo-actions-dev` y `.local/inmo-actions-prod`; publíquelos con `gh secret set VPS_SSH_KEY --env development --repo buitragopnicolas-prog/inmoviliaria < .local/inmo-actions-dev` y el equivalente de producción. Configure el entorno `production` con un revisor obligatorio, impida omitir sus reglas y proteja `main` con el check del workflow. `.github/known_hosts` fija la clave SSH del VPS. No copie las claves privadas al repositorio.

## Condiciones para promover a producción

No se ha desplegado esta versión en producción. Para promover el mismo commit probado en dev se requieren: CI verde, aceptación funcional de dev por HTTPS, revisión de los avisos de `npm audit --audit-level=high`, proveedor real de pagos y secretos configurados, respaldo verificado de PostgreSQL y MinIO, aprobación humana del SHA y aprobación del entorno GitHub. La auditoría actual tiene 4 avisos moderados y ninguno alto; la compuerta de producción falla si aparece un aviso alto. El ConfigMap de producción conserva `PAYMENT_PROVIDER=mock`; el script de despliegue también lo rechaza. La producción actual sigue con su imagen anterior.

No ejecute `db:seed` en producción. Una migración de esquema puede requerir un plan propio para revertirla; `kubectl rollout undo` solo revierte contenedores. La primera creación de una cuenta administradora en una base de producción nueva requiere un proceso separado que no cargue datos de demostración.

El despliegue por SSH utiliza `scripts/vps-ssh-entry.sh` y `scripts/deploy-vps.sh`. Revise su salida y las pruebas de dev antes de cualquier aprobación de producción. Los antiguos comandos de `DEPLOY_KUBERNETES.md` documentan la instalación original y no deben usarse para esta promoción.
