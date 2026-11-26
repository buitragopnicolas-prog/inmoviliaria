# Portada y catálogos de JB

El buscador abre el inventario de arriendos. A su lado, el portafolio usa fotografías, canon, barrio, ciudad, área y habitaciones publicados. La tarjeta central del carrusel tiene prioridad visual. Cada tarjeta enlaza directamente a su ficha. El directorio agrupa las acciones de encontrar, publicar y gestionar una cuenta. La portada editorial es la entrada predeterminada. Las variantes de diseño con `?estilo=` se consultan en el entorno local.

## Escena persistente de Bogotá

La misma escena acompaña el recorrido por los catálogos, el boletín, los servicios, las herramientas IA, los portales y la administración. La ficha conserva su galería y el mapa con el pin guardado. Los controles de selección del catálogo se mantienen disponibles con movimiento reducido. El servidor entrega enlaces y un formulario GET utilizables sin JavaScript. [Arquitectura de la aplicación](ARQUITECTURA.md)

## Publicidad por catálogo

En arriendos, el panel lateral muestra hasta tres ofertas inmobiliarias de venta. El gráfico compara los rendimientos brutos que se pueden calcular con los precios y cánones publicados. Administración → Ofertas permite editar el distintivo y el canon. En compra y venta, los destacados aparecen primero y los bienes muebles conservan una sección diferenciada. Los estados de inventario vacío y de servicio interrumpido tienen mensajes distintos.

Se adaptaron la composición del carrusel y la jerarquía visual del gráfico a las fichas, el teclado, la moneda y las fuentes de datos de JB. [Carrusel de 21st](https://21st.dev/@automateflows/components/glassy-coverflow-carousel) · [Gráfico de barras de 21st](https://21st.dev/@shadcnspace/components/chart-01)

## Verificación local

- `node scripts/skyline-edge.mjs` inicia una API sintética de lectura y una web compilada en loopback. Comprueba identidad del lienzo, luz ámbar, cámara, fichas, proyecciones, portales, alternativas de movimiento y navegación sin WebGL.
- `node scripts/editorial-home-edge.mjs` admite la variable `LOCAL_PREVIEW_URL` para recorrer el inventario local con Edge de escritorio y móvil, teclado y JavaScript desactivado.
- `npm run test:catalog-edge` retiene la respuesta del inventario y comprueba la edición de los filtros y el foco durante el envío.
