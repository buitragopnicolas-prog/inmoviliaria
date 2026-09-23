# Despliegue de Asesoría Inmobiliaria JB en Kubernetes

> **Instalación original.** Para el flujo actual separado de local, dev y producción use [la guía actual](docs/LOCAL_Y_DESPLIEGUES.md). No ejecute el seed ni aplique estos pasos de forma indiscriminada sobre producción existente.

Arquitectura:

Internet → Nginx del VPS (TLS 80/443) → Traefik NodePort 30080 → Ingress → Web/API → PostgreSQL/MinIO

## 1. Copiar el proyecto al VPS

```bash
mkdir -p /opt/asesoria-inmobiliaria
cd /opt/asesoria-inmobiliaria
unzip asesoria-inmobiliaria-produccion.zip
cd asesoria-inmobiliaria-produccion
```

## 2. Verificar herramientas de construcción

```bash
docker version
ctr version
kubectl get nodes
```

Si Docker está disponible, construir e importar las imágenes al containerd de Kubernetes:

```bash
cd /opt/asesoria-inmobiliaria/asesoria-inmobiliaria-produccion

docker build \
  -f apps/api/Dockerfile \
  -t asesoria-inmobiliaria-api:local .

docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://asesoriainmobiliariajb.com \
  -f apps/web/Dockerfile \
  -t asesoria-inmobiliaria-web:local .

docker save asesoria-inmobiliaria-api:local \
  | ctr -n k8s.io images import -

docker save asesoria-inmobiliaria-web:local \
  | ctr -n k8s.io images import -

ctr -n k8s.io images list | grep asesoria-inmobiliaria
```

Si Docker no está disponible, construya las imágenes en otro equipo Linux amd64, expórtelas con `docker save`, cópielas al VPS e impórtelas con `ctr -n k8s.io images import`.

## 3. Crear directorios persistentes

```bash
mkdir -p /var/lib/asesoria-inmobiliaria/postgres
mkdir -p /var/lib/asesoria-inmobiliaria/minio
chmod 700 /var/lib/asesoria-inmobiliaria/postgres
chmod 700 /var/lib/asesoria-inmobiliaria/minio
```

## 4. Namespace, configuración y secretos

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
bash k8s/create-secrets.sh
```

No publique `/root/asesoria-inmobiliaria-secrets.env`.

## 5. Almacenamiento, PostgreSQL y MinIO

```bash
kubectl apply -f k8s/02-storage.yaml
kubectl apply -f k8s/03-postgres.yaml
kubectl apply -f k8s/04-minio.yaml

kubectl wait --for=condition=ready pod \
  -l app=postgres \
  -n asesoria-inmobiliaria \
  --timeout=300s

kubectl wait --for=condition=ready pod \
  -l app=minio \
  -n asesoria-inmobiliaria \
  --timeout=300s

kubectl wait --for=condition=complete job/minio-init \
  -n asesoria-inmobiliaria \
  --timeout=300s
```

## 6. Migraciones y seed inicial

El seed fue corregido para leer las contraseñas iniciales desde el Secret, en lugar de usar contraseñas conocidas dentro del código.

```bash
kubectl delete job asesoria-db-init -n asesoria-inmobiliaria --ignore-not-found
kubectl apply -f k8s/05-db-init.yaml
kubectl wait --for=condition=complete job/asesoria-db-init \
  -n asesoria-inmobiliaria \
  --timeout=600s
kubectl logs job/asesoria-db-init -n asesoria-inmobiliaria
```

Consultar las credenciales iniciales:

```bash
grep -E 'ADMIN_INITIAL_EMAIL|ADMIN_INITIAL_PASSWORD|CUSTOMER_INITIAL_EMAIL|CUSTOMER_INITIAL_PASSWORD' \
  /root/asesoria-inmobiliaria-secrets.env
```

## 7. Aplicación e Ingress

```bash
kubectl apply -f k8s/06-apps.yaml
kubectl rollout status deployment/api -n asesoria-inmobiliaria --timeout=300s
kubectl rollout status deployment/web -n asesoria-inmobiliaria --timeout=300s
kubectl apply -f k8s/07-ingress.yaml

kubectl get pods,svc,ingress -n asesoria-inmobiliaria -o wide
```

Pruebas internas:

```bash
curl -I -H 'Host: asesoriainmobiliariajb.com' http://127.0.0.1:30080/
curl -I -H 'Host: asesoriainmobiliariajb.com' http://127.0.0.1:30080/api/properties
curl -I -H 'Host: www.asesoriainmobiliariajb.com' http://127.0.0.1:30080/
```

No cambie Nginx hasta que las pruebas por `30080` respondan sin `404` ni `502/503`.

## 8. Configurar Nginx externo

Respaldar la configuración actual:

```bash
cp /etc/nginx/sites-enabled/asesoriainmobiliariajb.com \
  /etc/nginx/sites-enabled/asesoriainmobiliariajb.com.backup-$(date +%Y%m%d-%H%M%S)
```

Instalar la nueva configuración:

```bash
cp k8s/nginx-asesoriainmobiliariajb.com.conf \
  /etc/nginx/sites-available/asesoriainmobiliariajb.com

ln -sfn /etc/nginx/sites-available/asesoriainmobiliariajb.com \
  /etc/nginx/sites-enabled/asesoriainmobiliariajb.com

nginx -t
systemctl reload nginx
```

Pruebas públicas:

```bash
curl -I https://asesoriainmobiliariajb.com/
curl -I https://asesoriainmobiliariajb.com/api/properties
curl -I https://www.asesoriainmobiliariajb.com/
```

## 9. Diagnóstico

```bash
kubectl get all -n asesoria-inmobiliaria
kubectl get pvc,pv
kubectl describe ingress asesoria-inmobiliaria -n asesoria-inmobiliaria
kubectl logs deployment/web -n asesoria-inmobiliaria --tail=200
kubectl logs deployment/api -n asesoria-inmobiliaria --tail=200
kubectl logs deployment/traefik -n traefik --tail=200
journalctl -u nginx -n 100 --no-pager
```

Interpretación:

- `404` en NodePort: el host no coincide o el Ingress no fue cargado.
- `502/503` en NodePort: Service sin endpoints o Pod no listo.
- `502` en dominio público: Nginx no alcanza `127.0.0.1:30080` o el backend falla.
- PVC `Pending`: confirme que el nodo se llama `srv1704143` y que los PV usan ese hostname.

## 10. NetworkPolicy opcional

Flannel básico puede no aplicar NetworkPolicy. Aplique este archivo únicamente si instala un CNI que las implemente, como Calico o Cilium:

```bash
kubectl apply -f k8s/08-network-policies.yaml
```

## Seguridad

- El archivo original incluía `.env` y contraseñas iniciales conocidas. No vuelva a subir `.env` ni `.git` en archivos de despliegue.
- Rote todas las contraseñas, tokens y llaves que hayan estado en el ZIP o en manifiestos compartidos.
- No publique PostgreSQL, MinIO ni el API de Kubernetes en Internet.
- Mantenga expuestos públicamente solo Nginx 80/443.

## 11. Instalación opcional de n8n

El paquete incluye n8n en el mismo namespace, con almacenamiento y base de datos independientes. Consulte:

```text
INSTALAR_N8N.md
```

Archivos relacionados:

```text
k8s/09-n8n-storage.yaml
k8s/create-n8n-secrets.sh
k8s/10-n8n-db-init.yaml
k8s/11-n8n.yaml
k8s/07-ingress.yaml
k8s/nginx-n8n-bootstrap.conf
k8s/nginx-n8n.asesoriainmobiliariajb.com.conf
```
