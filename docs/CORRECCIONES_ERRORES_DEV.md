# Correcciones de errores — 24 de septiembre de 2026

Base: `381a5f6`; restauración: `codex/restore-before-error-fixes-20260924`.

## Errores reproducidos y cambios

- **Inicio con `fetch failed` por timeout a la API.** La carga pública distingue
  indisponibilidad temporal de una respuesta vacía. El inicio conserva su contenido
  institucional y cada sección muestra su propio aviso con reintento. Catálogo y
  noticias también muestran ese estado. No se fabrican registros ni se reintentan
  automáticamente operaciones de escritura. Un header sin cookie de sesión evita
  consultar `/auth/me`.
- **500 en enlaces inexistentes de inmuebles y noticias.** El cliente conserva el
  estado HTTP y solo un 404 se traduce a `notFound()`, tanto en la página como en
  sus metadatos. Otros errores no se presentan como contenido inexistente.
- **500 con canon negativo, cero, texto o parámetros repetidos.** Los filtros se
  validan antes de consultar la API, con errores asociados a cada campo y mínimo
  de 1 COP. El usuario puede corregirlos sin perder los demás valores. Un filtro
  inválido no se muestra como una búsqueda con cero resultados.
- **Vencimientos un día antes en Colombia.** Las fechas civiles se presentan en
  UTC; los instantes de pagos y publicaciones se presentan en `America/Bogota`.
  Servidor y navegador obtienen el mismo resultado. No cambian los valores
  almacenados ni las reglas contractuales o de pago.

También se incorporan páginas de error y de contenido no encontrado, en español,
con navegación de recuperación y los estilos compartidos del sitio.

## Validación reproducible

```sh
npm run build
npm run check
npm run test:regressions
npm run test:web-errors
```

Las 14 pruebas de regresión cubren estados HTTP, fallos de red, mensajes de API,
ausencia de reintentos POST, multipart, filtros y fechas con procesos en UTC y
Bogotá. Las 10 pruebas web usan el build de Next y una API simulada en puertos
locales libres; verifican indisponibilidad, fallo parcial, recuperación, vacío y
404. No necesitan credenciales ni escriben en DEV. Ambos comandos se ejecutan en
CI antes del despliegue.

La revisión local en navegador comprobó el inicio recuperado, los errores de
canon y su corrección, y el 404 a 375 px sin desbordamiento. Las fechas del panel
se validaron con pruebas deterministas; su revisión visual con una sesión válida
sigue pendiente. No se cambian backend, esquema, autenticación ni permisos.
