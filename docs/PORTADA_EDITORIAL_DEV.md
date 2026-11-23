# Portada editorial de JB en DEV

La entrada pública reúne el portafolio fotográfico, el buscador de arriendos y el directorio para encontrar, publicar o consultar una cuenta. Cada ficha y su precio proceden del inventario publicado del entorno. Los rótulos editoriales se editan desde el contenido de la portada.

El modelo se activa en la raíz con `APP_ENV=development` o `local`. Los parámetros de las alternativas visuales previas se interpretan únicamente en local. El modo de movimiento reducido muestra fotos planas. El directorio y el formulario funcionan con HTML nativo.

El candidato de integración incluye los catálogos y portales que enlaza la portada. Su instalación en un entorno anterior requiere las migraciones de contenido y ventas, documentos y boletín, fuentes del boletín y perfiles de cuenta. Los datos, las publicaciones y el texto aprobado de privacidad se administran por entorno.

La prueba de escritorio y móvil se repite en el Compose local con `node scripts/editorial-home-edge.mjs`. Después de que CI, Sonar y la verificación del VPS aprueben el commit de DEV, la misma prueba puede ejecutarse por HTTPS con `node scripts/editorial-home-edge.mjs --dev`. Los pasos de promoción posteriores requieren una decisión específica.
