# Sonar obligatorio para dev y producción

El workflow espera el Quality Gate de Sonar y falla cuando el resultado no es aprobado, faltan credenciales, Sonar no responde o se agota el tiempo de espera. No hay una opción para omitir esta validación. Ambos despliegues dependen del job `validate` completo.

El servidor vuelve a consultar Sonar antes de construir imágenes, cambiar secretos o aplicar migraciones. Busca el análisis del SHA completo solicitado y consulta su Quality Gate por `analysisId`. Rechaza condiciones ignoradas, un análisis inexistente y cualquier estado distinto de `OK`. Comprueba además que el checkout esté limpio y coincida con ese SHA. La aprobación de otro commit no permite desplegar esta versión.

## Docker local

```powershell
npm run sonar:up
npm run sonar:bootstrap
npm run sonar:local
```

SonarQube abre en http://localhost:9002 y no ocupa el puerto 9000 de MinIO. El perfil `sonar` tiene PostgreSQL y volúmenes exclusivos; no utiliza datos de la aplicación. Los servicios ordinarios siguen arrancando sin ese perfil. Las imágenes de Sonar y del scanner están fijadas por digest.

La inicialización espera a Sonar, cambia la contraseña inicial `admin`, crea el proyecto `inmobiliaria-raiz-platform` y genera un token de usuario que permite analizar y consultar el Quality Gate. Guarda la contraseña nueva y el token en `.local/sonar.env`, excluido de Git y de las imágenes. Para abrir la interfaz use el usuario `admin` y la contraseña de ese archivo. No publique el archivo ni copie esas credenciales a la configuración de API/web.

`sonar:local` compila, valida tipos, ejecuta pruebas con cobertura LCOV, prueba los estados de error de la web y ejecuta el scanner en Docker. El scanner espera el Quality Gate; si Sonar lo rechaza, el comando termina con error. Para repetir solamente el análisis use `npm run sonar:scan`.

`npm run test:web-components` comprueba formularios reales con React y DOM simulado: envío de datos y decisiones, cancelación de eliminaciones, contratos, pagos y navegación con teclado. Solo sustituye las fronteras de Next (rutas y acciones del servidor); no utiliza datos ni servicios reales. Los mapas de fuentes llevan la cobertura del paquete de pruebas a los componentes TypeScript originales.

Puede configurar `SONAR_HOST_PORT`, `SONAR_PROJECT_KEY` y `SONAR_DB_PASSWORD` en `.env` antes de iniciar los servicios. Si cambia el puerto o la clave, pase esos mismos valores como `SONAR_HOST_URL` y `SONAR_PROJECT_KEY` al inicializador. La contraseña PostgreSQL local predeterminada sirve únicamente en la red privada de este perfil, cuya base no publica puertos.

Docker necesita recursos para Elasticsearch. Si Sonar no inicia, revise `docker compose --profile sonar logs sonarqube`; en un host Linux se necesita `vm.max_map_count=524288` y límites suficientes de archivos/procesos. Configure el host explícitamente; el proyecto no altera parámetros globales automáticamente.

## GitHub Actions y VPS

La instancia compartida está instalada en el VPS en `https://dev.asesoriainmobiliariajb.com/sonar`. Tiene PostgreSQL, red y volúmenes independientes, y publica su puerto Docker únicamente en loopback. Nginx utiliza el certificado HTTPS existente de dev y conserva las rutas de la aplicación.

La instalación reproducible usa `docker/sonar-vps.compose.yml`, `scripts/provision-sonar-vps.sh` y `scripts/configure-sonar-vps.py`. El proyecto es privado; GitHub usa el usuario `inmo-github-ci` con consulta y análisis, y el VPS usa `inmo-vps-verify` con consulta. Los secretos están en archivos root con permisos `600`, fuera del checkout. El token de GitHub se cifra dentro del VPS con la clave pública del repositorio antes de enviarlo como `SONAR_TOKEN`; no se copia en claro al equipo.

El comando SSH forzado instalado en `/usr/local/sbin/inmo-ssh-entry` comprueba Sonar antes de obtener el commit solicitado. Así, incluso un commit antiguo cuyo script de despliegue aún no incluía Sonar queda bloqueado si no está aprobado. El runtime Node verificado por SHA256 está en `/opt/asesoria-inmobiliaria/sonar/runtime`.

`Verify Sonar connection` comprueba en GitHub Actions el acceso autenticado al proyecto privado y que un SHA sin análisis sea rechazado. No despliega ni altera el estado del Quality Gate.

Configure en el repositorio:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Variable | `SONAR_HOST_URL` | URL HTTPS de Sonar |
| Variable | `SONAR_PROJECT_KEY` | Clave del proyecto cuya rama principal es `main` |
| Variable, SonarCloud | `SONAR_ORGANIZATION` | Organización de SonarCloud |
| Secreto | `SONAR_TOKEN` | Token con permiso para analizar y consultar análisis/Quality Gate |

SonarQube Community analiza únicamente la rama principal. Los PR ejecutan compilación, pruebas y validaciones; el análisis Sonar obligatorio se ejecuta sobre el commit de `main` antes de cualquier despliegue, incluyendo las ejecuciones manuales. No se envían secretos de Sonar a PR ni se usa `pull_request_target`. Para exigir Sonar antes de fusionar PR se necesita una edición que admita análisis de PR.

En el VPS, cree `/etc/asesoria-inmobiliaria/sonar.env`, propiedad del administrador y legible únicamente por el usuario autorizado de despliegue (por ejemplo, permisos `600` cuando despliega root):

```dotenv
SONAR_HOST_URL=https://sonar.su-dominio
SONAR_PROJECT_KEY=inmobiliaria-raiz-platform
SONAR_TOKEN=token_con_permiso_de_consulta
```

Un token exclusivamente de análisis puede no permitir consultar el historial; use un token de usuario con `Browse` en el proyecto para el verificador del VPS. No guarde ese archivo en Git. Node del VPS debe admitir `--env-file` y `fetch` (Node 22 o posterior, como el proyecto).

Si utiliza SonarCloud, añada también `SONAR_ORGANIZATION` al archivo del VPS.

Configure el check `validate` como obligatorio en la protección de `main`. Las aprobaciones humanas existentes para producción siguen siendo necesarias. Los scripts antiguos de instalación con `kubectl apply` no son el procedimiento autorizado de despliegue.

## Corregir y repetir

1. Consulte los problemas y condiciones fallidas en la interfaz de Sonar.
2. Corrija el código y añada pruebas que comprueben el comportamiento afectado.
3. Repita `npm run sonar:local` hasta obtener aprobación sin condiciones ignoradas.
4. Cree un commit con las correcciones y ejecute el pipeline sobre ese commit. Un reintento del código rechazado no sustituye la corrección.
5. Despliegue a dev únicamente después de todas las validaciones. Para producción, promueva el mismo SHA verificado en dev y aprobado por Sonar.

No se rebajan umbrales, excluyen archivos problemáticos ni ignoran condiciones para convertir un rechazo en aprobación. La cobertura se informa para todo el código de aplicación, incluyendo archivos aún sin pruebas.

Referencias: [esperar el Quality Gate](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/ci-integration/overview), [cobertura JavaScript/TypeScript](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/test-coverage/javascript-typescript-test-coverage).
