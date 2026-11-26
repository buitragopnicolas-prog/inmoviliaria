# UX y movimiento en Asesoría Inmobiliaria JB

**Análisis del 20 de noviembre de 2026, Bogotá.** La primera entrega propuesta abarca dos tareas de uso frecuente. El visitante debe poder buscar un arriendo desde el celular y editar sus filtros mientras llega el inventario. El arrendatario debe poder distinguir entre enviar un comprobante y obtener la confirmación de un pago. El movimiento sirve para indicar qué cambió y dónde continuar.

El bloque pertenece a la capa de presentación de la fase 1. Incluye recorridos de cuenta, cartera y administración que ya existen. La fase 2 incorpora catálogos de venta y de otros bienes. La fase 3 amplía los perfiles autorizados. En la entrega vigente, **Arrendar** abre el catálogo, **Comprar**, **Vehículos y bienes** y **Servicios** abren contacto con asuntos editables, y **Clientes** abre la cuenta mediante el login único. [Arquitectura V2](ARQUITECTURA_V2_JB.md) · [Memoria](MEMORIA_PROYECTO.md) · [Prompt maestro, secciones 5 a 19](PROMPT_MAESTRO_JB.md)

## Hallazgos de partida que determinaron el orden

| Prioridad | Evidencia al iniciar el bloque | Cambio propuesto y resultado observable |
| --- | --- | --- |
| Alta · mensaje de pago | En `/mi-cuenta`, el aviso de aprobación dependía de un parámetro de navegación. Las cifras de la tabla ya procedían de la API. La simulación usaba ese retorno. [Cuenta](../apps/web/app/mi-cuenta/page.tsx) · [Acción de retorno](../apps/web/app/actions.ts) | Derivar cualquier confirmación del estado del pago correspondiente a la factura y al usuario autenticado. Si al volver solo se conoce que terminó la navegación, mostrar la cartera actualizada. Con una factura sintética pendiente, regresar a la cuenta debe dejar visible el saldo pendiente y un mensaje coherente. |
| Alta · búsqueda en celular | En la instancia observada, una foto de referencia de 260 px precedía al formulario. Con una ventana de 390 × 844 px y 375 px útiles de ancho, el primer campo empezaba en **y = 934 px**. [Portada](../apps/web/components/home/HomeSections.tsx) · [Estilo móvil](../apps/web/components/home/HomeSections.module.css) | Situar el buscador antes de la fotografía en la composición móvil, con orden de lectura y teclado coherentes. En esa misma ventana, el primer campo debe quedar visible y enfocable antes de desplazarse. Mantener los cinco destinos junto al titular. |
| Alta · espera del catálogo | La portada ya cargaba destacados y noticias por separado. En `/inmuebles`, el título y los filtros esperaban la respuesta del inventario. La página ya contemplaba datos, cero coincidencias, filtros inválidos y fallo temporal con reintento. [Catálogo](../apps/web/app/inmuebles/page.tsx) · [Patrón de la portada](../apps/web/app/page.tsx) | Entregar título y formulario GET de inmediato y cargar solo los resultados bajo `Suspense`. Con una respuesta sintética retenida, el visitante debe poder leer y editar los filtros. Al resolverla, deben aparecer el conteo y las tarjetas del filtro solicitado. Probar también error, reintento, filtros inválidos y regreso con el historial. |
| Media · revisión administrativa | Al confirmar, pedir revisión o rechazar, el formulario bloqueaba los tres botones sin identificar la decisión en curso. [Revisión manual](../apps/web/components/ManualPaymentReviewForm.tsx) | Indicar la acción elegida con texto. Mantener estable el formulario. Solo la respuesta de la API habilita el mensaje final. Probar demora y error con un administrador sintético. |
| Media · ficha con varias fotos | El visor ya usa un diálogo nativo con botones, flechas, contador y devolución del foco. En móvil, cada miniatura ocupa una fila de 240 px antes de llegar al formulario de visita. [Galería](../apps/web/components/PropertyGallery.tsx#L34) · [Estilos de galería móvil](../apps/web/app/globals.css#L276) | En fichas con muchas fotos, presentar una foto principal y un acceso «Ver las N fotos». Mantener las fotos restantes accesibles y el contacto fácil de encontrar. Probar cero, una y varias fotos, enlace directo sin JavaScript, teclado, toque y cierre con retorno a la foto de origen. |

## Diseño y referencias de 21st.dev

La dirección aprobada para la portada es **Architectural Premium**, con fotografía identificada, azul profundo, dorado, Cormorant Garamond y Source Sans 3. Los controles comparten una duración de 180 ms, los paneles de 320 ms y la foto de portada de 720 ms. La portada usa CSS y `Reveal`. Desde la entrega 2, los avisos de cuenta, pago y conciliación usan `motion/mini`. [Contexto visual](../.21st/design.json) · [Estilos de movimiento](../apps/web/app/motion.css) · [Dependencias web](../apps/web/package.json)

| Referencia | Aplicación en JB |
| --- | --- |
| [Real Estate Search Hero](https://21st.dev/@felipemenezes098/components/hero-09) y [Property Preview Card](https://21st.dev/@shadcnspace/components/card-02) | Ya adaptadas en JB. Priorizar la búsqueda y conservar en cada tarjeta el canon, la administración y la disponibilidad visibles en pantalla táctil. El acento de foco o toque indica qué inmueble se abrirá. |
| [Shared Element Gallery](https://21st.dev/@jahed/components/shared-element-gallery) | Candidata para el laboratorio. Ensayar continuidad entre miniatura y foto ampliada sobre el diálogo de JB. Al solicitar movimiento reducido, abrir la foto directamente. Conservar botones y enlace HTML. |
| [Loading Button](https://21st.dev/@ddoemonn/components/loading-button) | Referencia para contacto, acceso y revisión administrativa. Reservar espacio para el texto de espera. En JB el resultado procede de la Server Action y del estado del negocio. El temporizador de la demostración solo simula una respuesta. |

Probar `motion/react` únicamente en el visor si la transición aporta orientación frente al fundido CSS actual. Antes de adoptarlo, comparar ambas versiones con las mismas fotos y el mismo dispositivo, medir el JavaScript transferido al entrar en portada y al abrir la ficha, y comprobar foco y apertura inmediata con movimiento reducido. Así el coste de la prueba queda localizado en la interacción que lo necesita. [Carga selectiva en Motion](https://motion.dev/docs/react-reduce-bundle-size) · [Preferencias de movimiento](https://motion.dev/docs/react-accessibility)

## Secuencia de entrega y aceptación local

| Entrega | Actor, permisos y datos | Prueba de aceptación propuesta |
| --- | --- | --- |
| 1. Portada y catálogo | Visitante anónimo. Lectura de publicaciones, barrio, ciudad y canon en la URL. | Abrir en celular, buscar por barrio, editar el canon, entrar en una ficha y regresar. Comparar carga lenta, cero resultados y error con reintento. Seguir también los cinco destinos con teclado. |
| 2. Cuenta, pago y conciliación | Usuario autenticado sobre sus facturas y comprobantes. Administrador autorizado sobre la decisión de revisión. NestJS valida la titularidad y el estado. | Con datos sintéticos, reportar un pago, observar «Pendiente de verificación», revisar y actualizar el saldo según la respuesta real. Probar rechazo, doble pulsación y regreso a la cuenta. El foco, el importe y la referencia deben seguir siendo identificables durante la espera. |
| 3. Ficha, contacto y acceso | Público para fotos y solicitudes. Asunto contextual editable. Login único y registro según la política del entorno. | Desde la ficha, ampliar y cerrar una foto, solicitar una visita y revisar el mensaje de envío. Probar error y reintento en contacto y login. Al cambiar el mensaje de estado, mantener el foco y los campos permitidos. |
| 4. Resto del sitio y administración | Noticias y Nosotros públicos. Herramientas IA ejecutadas por el visitante. Inventario, archivos, contratos y tablas administrativas bajo `ADMIN`. | En artículos, conservar el lugar de lectura. En IA, mostrar el progreso que devuelve la tarea. En el panel, abrir formularios, editar, guardar y volver a la fila correspondiente. Revisar tablas anchas, foco y anuncios de error. Mantener estables las filas y los importes durante la edición. |

En cada entrega, comparar móvil y escritorio, teclado y toque, y preferencias normal y reducida sobre la misma revisión. Verificar el HTML inicial de las rutas públicas, el tamaño de los recursos y el tiempo hasta poder interactuar. El laboratorio actual compara la portada y la intensidad de sus flechas. Extenderlo con una ficha sintética y estados de formulario permitiría comparar las interacciones propuestas antes de incorporarlas a las rutas de uso diario. [Laboratorio de desarrollo](../apps/web/app/laboratorio/motion/page.tsx#L42)

### Entrega 1 · Búsqueda pública de arriendos

El visitante anónimo abre la portada a 390 × 844 px, recorre los cinco destinos y enfoca «Barrio o inmueble» antes de desplazarse. Envía el formulario GET a `/inmuebles`, edita el canon mientras la respuesta de inventario está retenida y conserva el valor y el foco cuando aparecen las tarjetas. Al abrir una ficha y regresar, la URL identifica la consulta. Se comprueban además el resultado vacío, los filtros inválidos, el reintento de la consulta original y el acceso al resultado con JavaScript desactivado. El recorrido solo consulta publicaciones mediante los filtros públicos `search`, `city` y `maxRent`.

**Implementación local del 20 de noviembre de 2026.** El HTML de la portada presenta los cinco destinos, el formulario y la foto en ese orden. En escritorio, CSS sitúa la foto a la derecha del titular. En el catálogo, el título y los filtros se entregan antes de que se resuelva la consulta. Con JavaScript desactivado, los formularios solicitan la vista HTML completa. Quien abre directamente la URL tiene un enlace a esa vista mientras espera. El parámetro de presentación `vista=completa` se queda en la web. [Portada](../apps/web/components/home/HomeSections.tsx) · [Catálogo](../apps/web/app/inmuebles/page.tsx)

| Comprobación local | Resultado |
| --- | --- |
| Portada compilada en Edge | A 390 × 844 px, con 375 px útiles, el primer campo ocupó de **y = 661 a 709 px** durante la entrada y de **651 a 699 px** con movimiento reducido. La tabulación llegó al campo después de los cinco destinos con el desplazamiento en cero. Los cinco enlaces abrieron su destino con Enter. A 1440 × 900 px la foto ocupó la columna derecha. En ambos tamaños se comprobó la preferencia de movimiento y el ancho del documento. |
| Orden de entrega por HTTP | La prueba retuvo la respuesta de la API hasta recibir el título, el canon de la URL y el anuncio de búsqueda en el HTML. Al liberarla apareció el enlace a la ficha sintética. Un filtro inválido evitó la consulta. En la vista completa se recibió la ficha directamente. Pasaron las 12 comprobaciones de `npm run test:web-errors`. [Prueba HTTP reproducible](../scripts/test-web-errors.mjs) |
| Edición durante la espera | En este equipo el navegador recibió al final incluso una página HTTP de control enviada en dos partes. Para comprobar la interacción se reprodujeron en Edge los fragmentos originales de Next mediante una herramienta temporal de prueba. El canon admitió escritura antes de liberar la API y mantuvo el valor y el foco al aparecer el conteo y la tarjeta. Los 102 ms observados hasta editar corresponden a esta prueba controlada. La conexión ordinaria de Edge se verificó en el [seguimiento del 21 de noviembre](#seguimiento-de-entrega-1--filtros-y-nextjs-1646). |
| Navegación y recuperación | Con datos sintéticos se abrió la ficha por toque y se volvió a la consulta con el canon en la URL. Se observaron el resultado vacío, el filtro inválido y la recuperación de un error en la misma URL. Con JavaScript desactivado, tanto el envío desde la portada como la entrada directa dieron acceso al inmueble. |

El MCP oficial de 21st devolvió la ficha de *Real Estate Search Hero* (ID 19080) y el MCP local de shadcn/ui encontró `input-group`. Se reutilizaron los controles de JB. En esta medición móvil, Resource Timing registró 43 268 bytes de HTML y 148 314 bytes de scripts en la portada. El CLI de 21st revisó cinco archivos y señaló 18 usos preexistentes de colores literales. Pasaron la compilación web, los tipos de ambas aplicaciones, 36 pruebas de componentes, 27 de regresión y dos de arquitectura. Next.js 16.4.3 emitió un aviso de seguridad durante la compilación.

### Seguimiento de entrega 1 · Filtros y Next.js 16.4.6

**Criterio local del 21 de noviembre de 2026.** Un visitante sin sesión abre el catálogo de arriendos, edita barrio, ciudad y canon, y envía otra búsqueda mientras sigue pendiente la primera consulta. Solo se lee el inventario público. Edge debe mostrar los resultados de la última búsqueda, conservar el foco y cualquier edición posterior al envío, incluso si la primera respuesta llega al final. Comprobar sobre HTTP local con la API sintética retenida, tanto con Motion como con movimiento reducido. Verificar la versión de Next instalada, la compilación y los avisos de seguridad aplicables.

En la primera ejecución con 16.4.6, las 16 comprobaciones HTTP anteriores pasaron. Edge agotó los diez segundos esperando el formulario con el inventario retenido. El catálogo ahora entrega el documento del buscador y obtiene las tarjetas con una petición independiente a `GET /api/catalogo`. El envío mantiene los controles montados. El navegador cancela su petición anterior cuando cambian los filtros. La API de NestJS sigue decidiendo qué inmuebles se publican. La vista HTML completa usa la misma selección de campos y tarjetas. [Página del catálogo](../apps/web/app/inmuebles/page.tsx) · [Consulta pública](../apps/web/lib/public-catalog.ts)

| Recorrido en Edge 158.0.4370.33 sobre HTTP local | Resultado observado |
| --- | --- |
| Dos consultas pendientes | Con la primera respuesta retenida en la API sintética, se editaron los tres campos y se envió la búsqueda con Enter y, en el segundo recorrido, con «Buscar». La API recibió los valores enviados, incluidos Bogotá y un canon de 1 600 000 COP. |
| Llegada del inventario | Se escribió «Borrador sin enviar» en Ciudad. Al liberar la segunda respuesta aparecieron el conteo y la tarjeta. Ciudad conservó el foco y el borrador. La URL conservó Bogotá. Al liberar la primera respuesta siguió visible únicamente la tarjeta de la segunda búsqueda. |
| Preferencia de movimiento | Con Motion se observaron los fundidos del aviso de espera y del conteo, además de la entrada del formulario y la tarjeta. Con movimiento reducido los mismos textos y datos aparecieron de forma estática y se conservó el foco. |
| Historial y HTML | Atrás recuperó los filtros y la tarjeta de la consulta anterior. Con JavaScript desactivado funcionaron el enlace de entrada directa y un nuevo envío GET a la vista completa. |

**Reproducción.** Con Edge instalado, ejecutar `npm run build -w @inmobiliaria/web` y después `npm run test:catalog-edge`. La prueba levanta la web compilada y una API sintética en dos puertos locales. Pasaron los tres recorridos en Edge, 19 comprobaciones HTTP, 43 pruebas de componentes, 28 de regresión, los tipos y dos pruebas de arquitectura. [Prueba de Edge](../scripts/catalog-edge.mjs) · [Servidor y comprobaciones HTTP](../scripts/test-web-errors.mjs)

**Dependencias verificadas el 21 de noviembre de 2026.** El archivo de bloqueo resuelve Next.js y sus binarios SWC a 16.4.6. La auditoría `npm audit --workspace @inmobiliaria/web --omit=dev` devolvió cero vulnerabilidades conocidas en las dependencias de producción de la web. [Versión publicada por Vercel](https://github.com/vercel/next.js/releases/tag/v16.4.6)

### Entrega 2 · Cuenta, pago y conciliación

El arrendatario reporta una factura propia y regresa a Mi cuenta. La referencia de regreso identifica el pago dentro de las facturas que la API devuelve al titular. Solo un pago en `APPROVED` permite anunciar «Pago aprobado». El aviso identifica factura, referencia, importe y saldo actual. Un enlace antiguo, ambiguo o ajeno conduce a la cartera del titular. Un abono aprobado puede dejar saldo.

El administrador revisa el reporte desde conciliación. Mientras se guarda, la interfaz identifica la decisión enviada y conserva el foco, la nota, la referencia y el importe. Al solicitar revisión o rechazar, el saldo se mantiene. Al confirmar, la cuenta refleja el pago y el saldo que devuelve la API. La comprobación local incluye doble pulsación, error recuperable, regreso a la cuenta y movimiento normal y reducido, con identidades, facturas y comprobantes sintéticos.

**Resultado local, 20 de noviembre de 2026 (Bogotá).** Se probó la web compilada en Edge, con sesiones de arrendatario y administrador, API NestJS, PostgreSQL y MinIO de prueba y el escáner ClamAV local. El navegador envió los formularios reales. La Server Action envía a Nest únicamente los seis campos del reporte, incluido el comprobante opcional. Esto corrigió el rechazo del formulario al recibir metadatos internos de Next. [Acciones de pago](../apps/web/app/actions.ts) · [Contrato operativo](PAGOS_MANUALES_Y_N8N.md)

| Recorrido observado | Pago y saldo devueltos por la API |
| --- | --- |
| El arrendatario adjunta un PDF sintético y pulsa dos veces durante el envío. | Una solicitud de reporte. Mi cuenta muestra «Pendiente de verificación», su referencia y $3.400.000 de saldo. |
| El administrador solicita revisión sin motivo, corrige el formulario y después rechaza el reporte. | La API devuelve un error recuperable. La revisión con nota pasa a `UNDER_REVIEW` y el rechazo a `REJECTED`. El saldo sigue en $3.400.000. |
| El arrendatario reporta de nuevo. Administración confirma el segundo pago. | La segunda referencia queda en `APPROVED`, la factura pasa a `PAID` y el saldo queda en $0. Al reabrir la primera referencia, Mi cuenta sigue mostrando «Pago rechazado». PostgreSQL conserva las dos secuencias de auditoría y ambos PDF constan como `CLEAN` por ClamAV. |
| Otro arrendatario abre el enlace del pago aprobado. El titular abre el retorno antiguo. | El otro arrendatario solo ve su cartera. El retorno `?pago=aprobado` abre el resumen sin aviso de aprobación. La prueba de componentes cubre además una referencia repetida, un estado desconocido y un abono aprobado con saldo pendiente. |
| El titular utiliza el simulador local. | La pantalla de pago comprueba que el intento está pendiente y pertenece a esa factura. Tras confirmar, la acción vuelve con la referencia devuelta por la API. Mi cuenta muestra el pago aprobado y el saldo en $0. |

Durante una petición retenida se verificaron el foco por teclado, la referencia visible y una sola decisión enviada. El resultado administrativo siguió visible al salir la tarjeta de la cola. Edge ejecutó Motion en escritorio (1440 × 900) y mostró los estados estáticos con movimiento reducido en móvil (390 × 844). Se consultaron *Loading Button* de 21st (ID 23536) y `spinner` de shadcn/ui. La web usa `motion/mini` en los avisos, con 180 ms de fundido. La importación aislada de `animate` midió 3300 bytes gzip con esbuild. [Aviso compartido](../apps/web/components/StatusNotice.tsx) · [Pruebas de componentes y acciones](../scripts/web-components.test.mjs)

También se enviaron los formularios HTML de reporte y confirmación sin ejecutar JavaScript, con lectura del aviso antes y después. Pasaron la compilación web, los tipos de ambas aplicaciones, 39 pruebas de componentes y acciones, 35 de la suite de pagos y controles asociados, 27 de regresión, dos de arquitectura y 12 comprobaciones HTTP. El CLI de 21st revisó seis archivos de interfaz sin hallazgos. Sigue registrado el aviso de seguridad de Next.js 16.4.3. La entrega llegó hasta la verificación local.

### Entrega 3 · Ficha, contacto y acceso

El visitante abre un inmueble publicado con cero, una o varias fotos. Una ficha con varias imágenes presenta una portada y un acceso al conjunto. El visor recorre todas las fotos con botones y flechas. Al cerrar con Escape o con el botón, el foco vuelve al control de origen. Sin JavaScript se pueden abrir los originales. «Solicitar visita» lleva desde el encabezado al formulario del inmueble.

El envío público crea una solicitud con nombre, correo, teléfono opcional, asunto y mensaje. El asunto y el mensaje de visita son editables. Si falla el envío, los datos quedan disponibles para corregir y reintentar. Solo una respuesta satisfactoria permite anunciar la recepción. En el login, tras un error se conserva el correo, se vuelve a ingresar la contraseña y la sesión válida dirige al destino del rol. Verificar la espera, la doble pulsación y el foco, con Motion normal y reducido. Usar inmuebles, solicitudes y cuentas sintéticos en local.

**Verificación local del 21 de noviembre de 2026 (Bogotá).** Se usaron la web compilada, Edge y una API NestJS con datos sintéticos en PostgreSQL y MinIO. Un intermediario local permitió retener una petición y devolver un fallo de contacto antes de escribir. Los envíos correctos y la autenticación llegaron a Nest. Se consultaron *Shared Element Gallery* (21st, ID 11979), *Loading Button* (ID 23536) y el diálogo de shadcn/ui. La implementación reutiliza el diálogo nativo y el aviso de estado de JB.

| Recorrido | Resultado observado |
| --- | --- |
| Galería con cero, una y siete fotos | El marcador que persiste la API se presenta como «Sin fotografía». Con una foto se puede ampliar el original. Con siete se muestra una portada y «Ver las 7 fotos». Edge decodificó cada imagen, incluida una WebP cargada en MinIO. Las flechas y los botones recorrieron el conjunto en ambos sentidos y volvieron al inicio. |
| Teclado, toque y HTML | Enter y el toque abrieron el visor con el foco en «Cerrar galería». Escape en escritorio y el botón en móvil devolvieron el foco al control exacto de apertura. Con JavaScript desactivado se desplegó la lista de siete enlaces y se abrieron los originales WebP y SVG. |
| Visita y contacto | «Solicitar visita» enfocó el encabezado visible del formulario. Tab llevó a «Nombre». Se comprobaron los textos editables de la ficha y el asunto procedente de «Comprar». Tras un 503 se conservaron los cinco campos. Durante la espera, dos pulsaciones produjeron una sola petición y el botón mantuvo el foco. El reintento mostró la recepción y PostgreSQL registró una fila `NEW` con el mensaje corregido. La oficina coordina la fecha de visita. |
| Acceso | Nest rechazó la contraseña errónea. El botón conservó el foco, el correo siguió escrito y la contraseña quedó vacía. Al corregirla, el arrendatario llegó a `/mi-cuenta`. En una sesión independiente el administrador llegó a `/admin`. |

La prueba detectó que el navegador bloqueaba imágenes de otro puerto en la web compilada. Las fotografías propias ahora se entregan desde el mismo origen por la [ruta de fotos](../apps/web/app/fotos/%5B...ruta%5D/route.ts). La galería y los avisos de contacto y acceso comparten un fundido de 180 ms de `motion/mini`. La preferencia de movimiento reducido conserva las fotos, el texto de espera y el resultado. [Galería](../apps/web/components/PropertyGallery.tsx) · [Aviso de estado](../apps/web/components/StatusNotice.tsx) · [Criterios de regresión](../scripts/web-components.test.mjs)

En escritorio (1440 × 900) se observó la animación de la foto y de los avisos. En móvil (390 × 844, 375 px útiles) ambos se presentaron estáticos con movimiento reducido. La ficha mantuvo el ancho de la ventana en los dos tamaños. En una ejecución móvil local con un contexto nuevo por página, se enfocó el buscador a los 669 ms y se abrió el visor a los 757 ms desde el inicio de sus respectivas navegaciones. Resource Timing registró 148 156 bytes de scripts propios en portada y 154 990 en ficha.

Pasaron la compilación, los tipos de las dos aplicaciones, 42 pruebas de componentes y acciones, 27 de regresión, dos de arquitectura y 15 comprobaciones HTTP. El CLI de 21st revisó seis archivos de interfaz sin hallazgos. Sigue pendiente de actualización la versión 16.4.3 de Next.js por el aviso de seguridad que emitió la compilación. [Pruebas HTTP](../scripts/test-web-errors.mjs)

### Entrega 4 · Lectura, herramientas IA y edición administrativa

El visitante lee un párrafo de una noticia publicada, sale y vuelve a la misma noticia en la pestaña. Debe recuperar ese párrafo tras navegar o recargar. Una noticia distinta empieza en su propio lugar y un enlace con fragmento tiene prioridad. El texto del artículo sigue disponible en el HTML.

Al procesar una entrada sintética en IA, la descarga muestra la magnitud que comunica el SDK (archivo o total) y la ejecución identifica la fase real. Un evento sin magnitud mantiene una indicación textual. La finalización requiere el resultado de la tarea. Se comprueban error, reintento y foco durante la espera.

Un administrador guarda un inmueble desde su ficha de edición y una factura desde su editor en la tabla. Se conservan búsqueda y filtro. El foco vuelve al control de edición del registro por su identificador, incluso si cambia de página. Si el registro deja de coincidir, el foco vuelve al encabezado de resultados con una explicación. Un fallo mantiene abierta la edición. Comprobar teclado, tabla con desplazamiento horizontal y Motion normal y reducido con datos sintéticos en local.

**Resultado local del 21 de noviembre de 2026 (Bogotá).** Edge ejecutó la web compilada en escritorio (1440 × 900) y en móvil (390 × 844) con movimiento reducido. Se utilizaron dos artículos de 32 párrafos, 18 inmuebles y 18 facturas de prueba en PostgreSQL y una API NestJS local aislada. Para IA se descargaron modelos públicos y se ejecutó el SDK en el navegador.

| Recorrido | Comprobación observada |
| --- | --- |
| Noticias | Se dejó el párrafo 17 parcialmente leído. Al recargar, volver con Atrás o reabrir la tarjeta, la posición del párrafo quedó a menos de 4 px de la anterior. Otra noticia comenzó arriba. Un enlace a `#parrafo-5` abrió ese párrafo. El marcador usa el identificador del artículo, el índice de párrafo y la fracción leída en la pestaña. [Posición de lectura](../apps/web/components/NewsReadingPosition.tsx) |
| Herramientas IA | «Traducir texto» mostró los avances de modelo, vocabulario y léxico que comunicó el SDK. «La casa tiene un jardín.» produjo «The house has a garden.». En «Sugerir emojis» se interrumpió la descarga, se conservó la entrada y el reintento completó la inferencia. El SDK comunicó el avance total. El botón mantuvo el foco en ambos recorridos. Las pruebas de regresión cubren también eventos sin total, archivos concurrentes, fin de un archivo y avance de generación. [Presentación del progreso](../apps/web/lib/ai-progress.ts) · [Pruebas](../apps/web/lib/ai-tools.test.ts) |
| Inventario | Desde la segunda página filtrada, tanto «Volver a inmuebles» como guardar devolvieron el foco a «Editar» en el mismo inmueble. Un valor rechazado por Nest mantuvo abierto el editor y conservó la ciudad escrita. Se corrigió, se guardó y se contrastó la ciudad con PostgreSQL. Al cambiar el título para que dejara de coincidir con la búsqueda, se enfocó «Publicaciones» y se explicó la ausencia de la fila. |
| Facturación | Al cambiar el vencimiento, la misma factura pasó de la página 2 a la 1. El foco volvió a su botón «Editar», visible también en la tabla móvil. Se conservaron búsqueda y filtro y se verificó la nota en PostgreSQL. Al pasar la factura a vencida bajo el filtro de pendientes, el foco volvió a «Facturas emitidas». [Resolución de fila y página](../apps/web/lib/admin-lists.ts) · [Foco del listado](../apps/web/components/AdminReturnFocus.tsx) |

Los tres recorridos usan el fundido de JB con `motion/mini` para señalar el párrafo recuperado, la fase de IA o el control reenfocado. Los porcentajes provienen de las magnitudes comunicadas por el SDK. En movimiento reducido se actualizan el texto, las barras y el foco de forma estática. Se consultaron *Reading Progress* (21st, ID 23553) y `progress` en el registro gratuito de shadcn/ui. El CLI de 21st revisó once archivos de interfaz sin hallazgos.

Durante un guardado retenido, dos pulsaciones en inmuebles y en facturas produjeron un solo `PATCH` por formulario. El botón mantuvo el foco y un 503 dejó disponible el borrador para corregirlo. También se abrió la noticia completa con JavaScript desactivado, se siguió el enlace de Nosotros a Contacto y se comprobó el acceso a Archivos y a la vista de contrato con un administrador sintético.

En una muestra móvil local con contextos nuevos, el párrafo 17 se puso en pantalla a los 675 ms desde la navegación y seleccionar la herramienta de emojis tomó 1092 ms. Resource Timing registró 144 914 y 157 058 bytes de scripts del sitio respectivamente, antes de iniciar un modelo. Pasaron la compilación web, los tipos de ambas aplicaciones y 93 comprobaciones automatizadas (43 de componentes y acciones, 28 de regresión, cuatro del adaptador IA, dos de arquitectura y 16 HTTP). Se mantiene el aviso de seguridad de Next.js 16.4.3. [Pruebas de componentes](../scripts/web-components.test.mjs) · [Adaptador IA](../scripts/ai-runtime.test.mjs) · [Pruebas HTTP](../scripts/test-web-errors.mjs)

## Verificación en el lanzamiento local

La verificación posterior de las cuatro entregas se complementó con el [lanzamiento local del 21 de noviembre](MEMORIA_PROYECTO.md#lanzamiento-local-del-21-de-noviembre-de-2026). Allí se identifican las imágenes de la web y la API, los recorridos en el Compose de uso diario y las operaciones de escritura con datos sintéticos en una instancia separada.

## Evidencia de la revisión previa a la implementación

- **Navegador local.** La portada de `localhost:3000` mostró los cinco destinos y tres destacados. «Arrendar» abrió el catálogo con tres resultados. El titular servido usa un salto de línea y el código de trabajo emplea dos elementos `span`. La medición móvil corresponde a la instancia servida. La revisión visual de los últimos cambios y de los recorridos autenticados sigue pendiente.
- **Código de trabajo.** Se revisó el árbol local con cambios sobre `9cd5292`. Pasaron 36 pruebas de componentes, dos de límites de arquitectura y 27 de regresión. Son 65 casos automatizados. Las pruebas de aceptación descritas arriba corresponden a las entregas propuestas. [Componentes](../scripts/web-components.test.mjs) · [Arquitectura](../scripts/architecture.test.mjs) · [Scripts de regresión](../package.json)
- **Catálogo de diseño.** Se consultaron las fichas públicas de 21st.dev y el registro gratuito de shadcn/ui para el patrón de carga `skeleton`. El comando de revisión del CLI de 21st quedó sin ejecutar porque el paquete no estaba disponible en la caché consultada y el registro npm no resolvió desde esta sesión. Las dos referencias nuevas son propuestas de diseño.

## Catálogos de venta y contenido público editable

La oficina publica inmuebles en venta y vehículos o bienes desde **Administración → Ofertas de venta**. Una oferta requiere título, tipo de bien, descripción, precio en pesos y al menos una fotografía para aparecer en el catálogo. El arriendo conserva su inventario y su canon mensual. Las ofertas guardadas como borrador quedan fuera de la lista pública y de la ficha por identificador.

**Administración → Contenido del sitio** reúne la identidad de la marca, la portada, los accesos del inicio, los contratos y documentos, la cuenta y el contacto, Nosotros, servicios, encabezados y pie de página. La sección de contacto admite el enlace de una política existente o el texto que aporta la oficina. **Administración → Artículos** permite escribir o importar texto, guardar un borrador, publicar y corregir una pieza conservando su dirección.

Para repetir el recorrido sobre Compose local se ejecuta `node --env-file=.env scripts/editorial-local.mjs` desde la raíz con las cuentas sintéticas del entorno. La prueba modifica temporalmente secciones públicas, restablece sus valores y retira las ofertas y artículos que creó. Se mantienen los borradores en administración. [Recorrido en Edge](../scripts/editorial-local.mjs)

En Edge 158 se comprobó la apertura de los cinco destinos, el asunto según servicio, el acceso de cliente desde una sesión de administración, el cambio visible de la portada, la protección contra sobrescrituras y la foto con su leyenda en Nosotros. La política editorial se abrió desde el pie. Dos ofertas sintéticas, un inmueble y una estufa, aparecieron en sus catálogos con dos fotografías. El visor devolvió el foco al cerrar. La importación de un artículo de texto conservó sus párrafos y la corrección del título mantuvo la URL. La animación de entrada de Servicios respondió a la preferencia de movimiento reducido. En siete páginas públicas la ventana móvil de 390 px mantuvo el ancho del contenido en 390 px.

También se publicaron cambios temporales en el nombre de la marca, el título de contratos, el acceso de visitas y el nombre del servicio jurídico. La web mostró los cuatro cambios y el contacto heredó el nuevo nombre del servicio. Se probó el enlace externo de la política y su alternativa de texto propio. La API rechazó la escritura anónima y la de una cuenta de cliente. Los tipos, dos controles de arquitectura, las 136 pruebas de la suite unitaria, 19 comprobaciones HTTP y los tres recorridos de filtros en Edge pasaron en local. Las 16 pruebas simuladas del verificador de DEV se ejecutaron en un contenedor local.

Las imágenes usadas en el Compose de verificación fueron `d36cc9f5abe3` para la web y `5a7bff1b5a55` para la API. La base aplicó la migración `20261122000100_public_content_and_sales`. La publicación del sitio usa Next.js 16.4.6.

## Documentos, boletín y buzón

**Validación local del 23 de noviembre de 2026.** El panel y el portal comparten los visores de PDF de la web. Cada apertura consulta la asignación o publicación en la API. Las fotografías, los contratos firmados y los comprobantes de pago conservan sus rutas. Los formularios ofrecen confirmación, pendiente y error mediante los avisos de Motion de JB.

| Recorrido verificado en Edge 158 | Resultado observado |
| --- | --- |
| Administrador → Documentos por cliente → cuenta registrada | El PDF conservó su nombre con tildes y apareció en la cuenta elegida. Otra cuenta recién registrada recibió un PDF antes de tener un contrato. Un archivo de texto con extensión PDF recibió 400. |
| Cliente → login con correo y contraseña → Mis documentos PDF | El enlace entregó el PDF en línea y la descarga entregó los mismos bytes. Otra cuenta recibió 404 y el visitante sin sesión recibió 401 en la web privada. La API pública de archivos tampoco mostró el PDF. |
| Arrendar → Solicitud de arrendamiento | La solicitud y el contrato modelo se abrieron sin sesión. Al sustituir la solicitud, su enlace anterior devolvió 404. Edge abrió un formato con su visor nativo de PDF. |
| Administrador → Boletín jurídico y noticias | Un concepto jurídico conservó un resumen de 901 caracteres, tres fuentes y dos PDF. Los adjuntos del borrador devolvieron 404. Al publicar, un visitante abrió el PDF. Al ocultar, volvió a responder 404. |
| Contacto → Buzón de sugerencias | Se recibió una opinión anónima y se consultó en administración. La API de lectura respondió 401 al visitante y 403 al cliente. |
| WhatsApp y accesibilidad | El enlace de WhatsApp coincidió con el número autorizado. A 390 px el buzón conservó el ancho disponible y el titular respetó la preferencia de movimiento reducido. |

Las imágenes locales verificadas fueron `71b1d34d0744` (web) y `86ef63c6dc60` (API). Pasaron tipos, dos controles de arquitectura, 136 pruebas unitarias, 19 comprobaciones HTTP y tres recorridos adicionales del catálogo en Edge. El CLI de 21st revisó 21 archivos de interfaz sin hallazgos. Se reutilizaron los formularios, enlaces y avisos del proyecto.

Para repetir las escrituras se utiliza un proyecto Compose de prueba con volúmenes propios. Partiendo del Compose principal ya compilado y en marcha, se ejecutan estos comandos desde la raíz en PowerShell. El proyecto de prueba se llama `jbdocsqa`. Su API y su web escuchan exclusivamente en loopback.

```powershell
$documentTest = @('--context','desktop-linux','compose','-p','jbdocsqa','-f','docker-compose.yml','-f','docker/documents-test.compose.yml')
docker @documentTest up -d --no-build postgres minio
docker --context desktop-linux network connect --alias test-scanner jbdocsqa_default inmobiliaria_clamav
docker @documentTest up -d --no-build --wait web
node --env-file=.env scripts/document-portal-local.mjs
docker --context desktop-linux network disconnect jbdocsqa_default inmobiliaria_clamav
docker @documentTest down --volumes
```

La instancia de prueba comparte el escáner de archivos y usa sus propias cuentas, base y objetos. [Prueba de recorridos y permisos](../scripts/document-portal-local.mjs) · [Configuración de la instancia aislada](../docker/documents-test.compose.yml)

## Portales, publicaciones y privacidad

Bloque local del 23 de noviembre de 2026. La autorización se solicita de forma expresa y queda vinculada a la política que se mostró. El catálogo público de arriendos y el de ventas comparten el inventario publicado por propietarios. Cada cuenta conserva su propio historial de cobros. La plantilla de servicios admite ocho espacios con descripciones extensas y los mensajes llegan a la bandeja de administración.

El recorrido `node --env-file=.env scripts/account-portals-local.mjs` se ejecuta con la composición desechable de documentos descrita arriba. Usa Edge y el antivirus del entorno local. Registra cuentas de prueba, edita el servicio ocho y envía un contacto. Comprueba el rechazo sin autorización y con versión antigua, la edición ajena, las facturas de un tercero, la privacidad del PDF, el arriendo, la venta, el catálogo mixto y la conciliación manual de facturas directas. Comprueba la disposición móvil y Motion con ambas preferencias. La política sintética del ensayo se limita a esa composición. El sitio principal usa el contenido que JB autorizó para pruebas locales.

Resultado local verificado en Microsoft Edge 158.0.4370.33. El propietario completó el alta y guardó un borrador con fotografía desde el navegador. Al retirar la venta, tanto la ficha como la fotografía devolvieron 404 al visitante. La vista privada de la foto respondió al propietario. El importe de las facturas directas quedó pendiente al reportar el pago y el saldo llegó a cero después de la confirmación administrativa. Se comprobó en PostgreSQL la existencia de autorizaciones con versión y texto para las cinco operaciones. El sitio principal sirvió la política de JB desde el pie y los formularios de registro y contacto mostraron la misma versión con casilla obligatoria inicialmente desmarcada. Pasaron las comprobaciones de tipos y arquitectura, la suite unitaria y los recorridos de documentos y contenido editorial en Edge.

## Comparación local de portadas con 21st

El visitante cambia la portada con enlaces en `http://localhost:3000/`. Las alternativas usan el contenido publicado por la oficina, el formulario GET de arriendos y los destinos de compra, bienes, servicios y portales. El selector se habilita con `APP_ENV=local`. Luz es la primera opción de la comparación. La decisión para otros entornos queda a cargo de JB.

| Portada | Interacción que se puede probar |
| --- | --- |
| Luz | Mover o tocar la fotografía para orientar la luz, activar el mapa de calor y borrar la huella. En un teléfono compatible, la persona puede activar la inclinación. Al abandonar la pestaña se detiene el sensor. |
| Órbita | Abrir el anillo de fotos del inventario público y recorrer las vistas con botones, flechas, rueda sobre la galería enfocada o un gesto horizontal. El pie de foto abre la ficha y muestra el canon. La preferencia de movimiento reducido ofrece imágenes planas. |
| Recorridos | Abrir uno de tres grupos según la gestión deseada. Los enlaces del directorio y el buscador funcionan con el teclado y con JavaScript desactivado. |
| Original | Usar la portada anterior como referencia de lectura y navegación. |

La sesión de diseño utilizó componentes del catálogo y bocetos generados con la cuenta de pago de 21st. La implementación funciona con el paquete Motion del proyecto. El mapa toma muestras de interacción sobre la fotografía mientras está activado. Se dibujan en un lienzo temporal y se descartan al desactivarlo o salir. La aplicación no transmite las coordenadas ni las lecturas del sensor.

Para reproducir la prueba de interacción en el Compose local, ejecutar `node scripts/design-portals-edge.mjs` con inventario público que incluya al menos dos fotos. El ensayo guarda capturas en `.local/21st-portadas/`. Para probar la caída del inventario y el catálogo vacío con una API aislada, compilar la web y ejecutar `node scripts/test-web-errors.mjs --portadas`. La ejecución sin el indicador comprueba el inicio fuera del entorno local.

En Microsoft Edge 158.0.4370.33 se contrastaron los siete enlaces de cada diseño, el envío de tres filtros, la apertura de una ficha, la navegación por fotos mediante teclado, rueda y deslizamiento táctil, y la apertura del portal de propietarios desde el directorio. El ensayo pintó y borró la huella en el lienzo y comprobó la respuesta de la luz a lecturas de orientación simuladas. La comprobación del sensor físico queda pendiente en un teléfono compatible. Se ensayó el modo de movimiento reducido y el directorio sin JavaScript. En una ventana de 390 × 844 px, el primer campo de búsqueda se vio completo al abrir Luz y Original. El enlace móvil de Órbita y Recorridos llevó el foco directamente a ese campo y lo dejó visible bajo el encabezado. La API aislada permitió verificar la galería vacía y el fallo recuperable. El selector se mantuvo restringido al entorno local.

El revisor de 21st señaló dos colores definidos directamente en el efecto de luz y en el lienzo de calor. Las superficies, tipografía, controles y trazos del directorio usan las variables visuales de JB. [Bocetos iniciales](https://21st.dev/ai/592ab3bd-ac7d-402e-a0fa-cd6080fa9128) · [Boceto de Recorridos](https://21st.dev/ai/9a47e618-5f76-4602-8468-d26a77a4f8f3)

## Portada editorial seleccionada para DEV

**Recuperación del almacenamiento para el lanzamiento.** El responsable autorizó importar desde local las dos imágenes inmutables de MinIO mediante el acceso exclusivo de DEV. El operador entrega un archivo cifrado al entorno `development`. El servidor verifica tamaño y SHA-256 antes de importarlo. El recorrido termina al comprobar el almacenamiento, el despliegue del commit aprobado y las rutas públicas de prueba en Edge. La transferencia contiene únicamente imágenes del proveedor y usa un acceso temporal.

En el ensayo de liberación, `containerd` registró las dos referencias por digest. En Edge 158 se retuvieron las respuestas reales de `/api/catalogo` del Compose local hasta editar y enviar ciudad y canon. El formulario conservó el borrador y el foco al recibir el resultado en las modalidades de movimiento normal y reducido. [Transferencia validada en local](https://github.com/buitragopnicolas-prog/inmoviliaria/pull/26)

La referencia reúne en una página el portafolio en anillo o tambor, la búsqueda con foco cálido y los caminos para buscar, publicar o entrar a una cuenta. Los formularios y las fichas leen los datos del entorno. La prueba recorre la galería con teclado, envía filtros al catálogo, abre una rama del directorio con JavaScript desactivado y comprueba la vista móvil y el movimiento reducido. La autorización de promoción cubre DEV. Las instrucciones de la maqueta, las fichas ficticias y los recursos de demostración se sustituyeron por componentes de JB.

La prueba en Edge verificó la portada de 1.440 px y la de 390 px, buscó por barrio, ciudad y canon y abrió los siete destinos del directorio. La primera ejecución de main pasó el recorrido de pagos, pero Sonar bloqueó el despliegue del commit `04119f3`. [Prueba de portada](../scripts/editorial-home-edge.mjs) · [Ejecución de lanzamiento](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45136153896)

El commit `f4accb1` obtuvo la aprobación de Sonar en GitHub y en el VPS. La inicialización de MinIO de DEV caducó en dos intentos antes de servir las imágenes de la aplicación. [Control de despliegue del VPS](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45146501875)

En DEV, Edge 158 abrió la portada editorial y sus siete destinos con HTTP 200, recorrió la galería y verificó el mapa de calor y su borrado. Al retener las respuestas auténticas del catálogo, el formulario aceptó ciudad y canon y mantuvo el foco y el borrador al llegar los resultados con ambas preferencias de movimiento. La comprobación móvil usó 390 px y la navegación sin JavaScript alcanzó los siete destinos. [Portada en DEV](https://dev.asesoriainmobiliariajb.com/)

**Reintento de la comprobación interna.** El job de rol de PostgreSQL agotó su plazo en el segundo intento. En el tercero pasó y el job de política de MinIO terminó con código 137. La portada y el catálogo seguían disponibles. El candidato debe mostrar la versión activa, el estado del job y la causa registrada por Kubernetes en DEV. Se conserva el control de Sonar y el despliegue solo se marca como verificado después de las pruebas internas completas.

**Entrega verificada en DEV.** El 23 de noviembre de 2026 se cotejaron el comprobante del VPS y las imágenes de la réplica lista de la web y de la réplica lista de la API. Los tres identificadores correspondían a `e3ced9f81f98fc5855a84b0c65d1bead1c7c57a2`. El alcance entregado incluye portada editorial, catálogos y entradas por perfil. La prueba posterior de infraestructura `77da48b` se detuvo por presión de disco al iniciar el job de PostgreSQL. El siguiente lanzamiento requiere resolver esa incidencia del nodo. [Estado confirmado por el VPS](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45242223389/job/137935825659)


## Galería y ubicación de inmuebles · 24 de noviembre de 2026

### Galería

En la portada, «Ampliar foto» abre la foto seleccionada en el visor. Al cerrarlo con Escape o con el botón, el foco vuelve al enlace que lo abrió. Edge 158 abrió dos fotografías reales del inventario de prueba a través de la ruta de fotos de la web. Se comprobó también la navegación móvil con movimiento reducido. [Prueba de portada](https://github.com/buitragopnicolas-prog/inmoviliaria/blob/21af6ca440bc0fc8a27caa8afc6386ca4fcf4e2e/scripts/editorial-home-edge.mjs)

### Mapa

El propietario o administrador puede elegir un punto con el ratón, el tacto, las flechas del teclado o las coordenadas, y después guardar o retirar el pin. La ficha pública muestra el pin guardado sobre OpenStreetMap y permite abrirlo en Google Maps. En fichas anteriores sin coordenadas, «Ver mapa de Colombia» abre el país sin marcadores y el enlace a Google Maps permite buscar la dirección publicada. Edge 158 comprobó la carga de las calles, el arrastre, el guardado y la retirada en el recorrido local de arriendo y venta. [Cambios y pruebas](https://github.com/buitragopnicolas-prog/inmoviliaria/pull/28)


El reintento completó la configuración de PostgreSQL y la política de MinIO, incluida la prueba de escritura, lectura y privilegios. El VPS registró 31 GiB libres y 84 % de uso. La revisión autorizada tampoco registró imágenes retiradas en este intento. El último mensaje del servidor fue la instalación de dependencias de la imagen de la API a las 19:36 de Bogotá. Ante la pérdida de acceso al dominio desde dos redes, se canceló el reintento SSH en GitHub a las 20:12. El servidor no devolvió un comprobante para la versión nueva. La comprobación externa del recorrido público requiere recuperar la conexión al VPS desde el alojamiento. [Registro del reintento](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45516790588/job/138886110330)


### Galería y ubicación verificadas en DEV

El 24 de noviembre de 2026 a las 23:49 de Bogotá, el VPS completó la migración y los despliegues de API y web, verificó el acceso, el almacenamiento y el escáner y registró el SHA `6ccfa95900fa8f814610346d70a09f63a6842703`. Las comprobaciones previas y posteriores a la importación encontraron espacio disponible y conservaron todas las imágenes. Se retiraron la credencial y el paquete temporal de transferencia. [Registro del VPS](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45547806638/job/138984822899)

**Galería.** Edge 158 abrió la segunda imagen de la portada, mostró una imagen de 1200 × 760 px, navegó entre imágenes y devolvió el foco a «Ampliar foto» al cerrar con Escape. Se probaron movimiento normal y reducido, además del recorrido móvil, los filtros y los siete destinos públicos. Los tres arriendos publicados tienen cuatro ilustraciones de muestra en total. La comprobación con una fotografía subida por archivo se hizo en el entorno local aislado. [Galería de DEV](https://dev.asesoriainmobiliariajb.com/#portafolio)

**Mapa.** Edge abrió «Ver mapa de Colombia» en la ficha de Loft Norte Usaquén, cargó las teselas de OpenStreetMap y mostró el enlace para buscar la dirección en Google Maps. Los tres arriendos existentes carecen de coordenadas guardadas. El catálogo de compra respondió correctamente y devolvió cero publicaciones. La selección, guardado y retirada del pin en arriendo y venta tienen evidencia en las pruebas locales y de integración. [Ficha comprobada en DEV](https://dev.asesoriainmobiliariajb.com/inmuebles/loft-norte-usaquen)


## 25 de noviembre de 2026 · Escena persistente de Bogotá

**Recorrido.** La misma instancia de WebGL debe pasar de portada a catálogo, ficha, historial y portales. Las fichas acercan la cámara en 720 ms. El desplazamiento separa cerros, edificios y tejados. El puntero ilumina únicamente la zona de la fachada que alcanza su radio. La escena deja disponibles los controles, la lectura y la navegación por teclado.

**Accesibilidad y aislamiento.** El primer HTML incluye tres imágenes locales. La preferencia de movimiento reducido mantiene el panorama fijo y libera WebGL al activarse. El formulario de herramientas IA reside en un documento del mismo origen con los permisos específicos para WASM y modelos. La navegación principal conserva su política habitual.

**Evidencia local.** El recorrido `node scripts/skyline-edge.mjs` comprueba identidad del lienzo, zoom efectivo, scroll, cambio cromático, acceso a los dos perfiles sintéticos, móvil y ausencia de WebGL. Las capturas quedan en `.local/bogota-edge/` del checkout de desarrollo. Las referencias visuales se interpretaron a partir de la descripción de JB.

## 25 de noviembre de 2026 · De los cerros a la calle

**Persistencia y cámara.** `BogotaExperienceManager` mantiene en contexto la ruta, la pose de cámara y el avance de lectura. React Three Fiber dibuja la composición sobre un solo plano. ScrollTrigger y Observer leen el desplazamiento nativo y la posición del pie. GSAP interpola el zoom y el paneo por ruta. Flip mueve el indicador de navegación y Motion funde el contenido HTML.

**Iluminación y accesibilidad.** El shader mezcla azul noche, rojo arcilla y ocre con las tres capas del panorama. Un ciclo de 52 segundos ilumina los bordes de las fachadas y el puntero proyecta luz ámbar hasta la calle. Con movimiento reducido desde la entrada, las imágenes y el contacto se muestran mediante CSS. Un cambio de preferencia durante la sesión suspende o reanuda la animación en el mismo canvas. El lienzo decorativo deja libres el teclado, el tacto y los enlaces.

**Verificación.** En el checkout de desarrollo, `node scripts/skyline-edge.mjs` comprueba la cobertura de toda la ventana, el color bajo el puntero, la transición al pie, los campos de contacto, la persistencia entre rutas y el movimiento reducido. Las capturas están en `.local/bogota-edge/`. El enlace directo al pie y la ficha de Casa Restrepo se comprobaron también en la vista de lectura del inventario local.

## 26 de noviembre de 2026 · Atlas de inmuebles sobre Bogotá

**Portada y catálogo.** La escena WebGL persistente dibuja un octaedro y un halo por marcador visible. Una onda de radar y una entrada escalonada de GSAP introducen los puntos. El foco, el cursor o el tacto activan la tarjeta de datos, el pulso y el encuadre. Los enlaces de la lista comparten la selección de la escena. La navegación conserva la identidad del inmueble mediante su slug. Flip anima el paso entre el portafolio y la ficha. Los filtros mantienen el envío GET y la lista conserva una vía de navegación sin JavaScript.

**Acceso y precisión.** El marcador es un botón HTML con nombre accesible y estado expandido. Enter lleva el foco al enlace de la tarjeta y Escape lo devuelve al punto. Con movimiento reducido o sin WebGL, la selección se mantiene disponible mediante indicadores estáticos. La vista esquemática distingue pin publicado, centro aproximado de zona y ubicación pendiente.

**Pruebas repetibles.** `scripts/editorial-home-edge.mjs` comprueba los datos, los enlaces, el cambio de ficha, el teclado, el tacto y el movimiento reducido. `scripts/skyline-edge.mjs` usa una API sintética en loopback para comparar una coordenada guardada, un sector y una ubicación desconocida. El esquema técnico se conserva en `docs/PORTADA_EDITORIAL_DEV.md` y `docs/ARQUITECTURA.md` del checkout de desarrollo.

## 26 de noviembre de 2026 · Contrato de interacción global

Esta entrega sustituye el atlas de marcadores en portada y catálogo. Las ofertas se representan mediante enlaces HTML con fotografía y precio. La coordenada publicada se utiliza como mejora del encuadre. La ficha conserva el mapa geográfico bajo petición.

| Recorrido | Criterio de aceptación |
| --- | --- |
| Inicio → ficha → atrás | El mismo canvas permanece montado. El slug recupera la selección del carrusel. Las flechas, Inicio y Fin recorren las tarjetas con teclado. |
| Arriendos y resultados diferidos | El filtro admite edición y envío durante la carga. La llegada del inventario respeta el foco y los cambios que quedan por enviar. |
| Arriendos → oportunidades de inversión | Renderizar hasta tres inmuebles en venta. Mostrar barras y porcentaje solo con canon y precio válidos. Distinguir datos incompletos, inventario vacío y error de servicio. |
| Compra y venta y vehículos | Ordenar primero las promociones establecidas por administración. El escaparate de bienes tiene navegación y enlaces propios. |
| Noticias, contacto, herramientas, cuenta y administración | Compartir la escena, los tokens de contraste y las entradas de paneles desde el layout. Conservar los permisos y el aislamiento del procesamiento IA. |
| Preferencias y alternativas | Respetar cambios de movimiento reducido en vivo. Mantener navegación por teclado, enlaces en HTML y representación estática sin WebGL2. |

La matriz de Edge utiliza inventario real de lectura y una API de prueba separada para roles y ejemplos de rentabilidad. La arquitectura de referencia está en [Arquitectura](ARQUITECTURA.md) y los comandos reproducibles en [Portada y catálogos](PORTADA_EDITORIAL_DEV.md).

En Edge 158 se recorrieron 17 páginas públicas en local y los seis alias conservaron la consulta. Se abrió la galería de Casa Restrepo, se avanzó de foto y se regresó al portafolio. La prueba de filtros retuvo la respuesta, comprobó el foco y el borrador, descartó la respuesta obsoleta y repitió el recorrido con movimiento reducido. Con una oferta sintética de COP 300.000.000 y un canon mensual estimado de COP 2.000.000, el panel mostró 8 % bruto anual. La oferta sin canon mostró el estado pendiente. Las compilaciones de API y web, tipos, 47 pruebas de componentes, 28 regresiones y dos verificaciones de arquitectura finalizaron correctamente.

## 26 de noviembre de 2026 · Visibilidad de la identidad JB

| Recorrido | Verificación |
| --- | --- |
| Cabecera al entrar, antes de interactuar | El monograma dorado, el horizonte y «Asesoría Inmobiliaria» forman parte del HTML. El enlace de inicio tiene un nombre accesible procedente del CMS. |
| Acceso y menú móvil | La firma cabe en una fila junto a Ingresar y al botón del menú. Anchos comprobados en Edge: 320, 390, 768, 1024 y 1440 px. |
| Pie y contacto | Se muestra la firma completa blanca en un panel azul oscuro. La dirección, el teléfono y el correo siguen usando los datos locales de contacto. |
| Catálogos, servicios, cuenta y administración | La navegación conserva el fondo de Bogotá. Los importes de las tarjetas se componen en dorado; los estados funcionales mantienen texto y señalización propios. |
| Movimiento reducido | Tanto el logotipo como las leyendas son visibles en reposo. Se conserva el horizonte con iluminación dorada en la ilustración que sustituye a WebGL. |

La comprobación visual se complementa con `node scripts/skyline-edge.mjs`, que recorre el acceso, los portales sintéticos y la preferencia de movimiento en Edge. La [identidad técnica](IDENTIDAD_JB.md) documenta los activos y las variantes.

## 26 de noviembre de 2026 · Finanzas, ubicaciones y publicación de imágenes

| Recorrido | Criterio de aceptación |
| --- | --- |
| Mercados | Cinco instrumentos con unidades y enlaces a sus fuentes. El detalle muestra la hora del último dato. La variación usa el cierre de una sesión anterior, incluso después de un festivo o un cambio de hora. Un fallo individual mantiene el dato comprobado o muestra la indisponibilidad. |
| Movimiento | La cinta y el carrusel se pueden pausar y reanudar. La preferencia de movimiento reducido evita el desplazamiento automático. Las cotizaciones y la lista de ciudades permanecen accesibles en el detalle. Escape cierra el detalle y devuelve el foco al control. |
| Relojes | Los cuatro relojes avanzan cada segundo visible. Hora de 24 horas, fecha y AM/PM corresponden a la zona de cada ciudad. Se comprueban por separado verano, invierno y cambio de día. |
| Portales | La foto de arrendatarios tiene contenido inicial. Publicar desde el editor actualiza el portal público y la cuenta de ese perfil. La imagen elegida se previsualiza. Un visitante sin sesión pasa por ingreso y una cuenta arrendataria vuelve a su espacio si intenta acceder al editor. |
| Alianzas | Una fotografía contextual acompaña la invitación. El botón abre el contacto con el asunto correspondiente. En el editor se pueden sustituir la foto, el texto alternativo, el título, la descripción y el vínculo. |
| Responsive | A 320, 390 y 1440 px, el detalle de mercados cabe dentro de la pantalla. El usuario puede recorrer el editor y consultar datos sin animación. |

Pruebas reproducibles desde la raíz del checkout: `npm run test:regressions`, `npm run test:web-components`, `npm run test:architecture` y, después de compilar la web, `node scripts/business-tools-edge.mjs`. La última utiliza una API desechable y publica una imagen en memoria a través de las acciones reales de Next. El entorno local del puerto 3127 permite repetir el recorrido con autenticación, PostgreSQL, MinIO y escaneo de archivos.

**Resultado local.** Edge 158 verificó el ingreso con credenciales de prueba, la carga de dos archivos WebP por administración, su previsualización y su publicación en PostgreSQL y MinIO con ClamAV activo. Arrendatarios y la cuenta privada devolvieron la foto elegida y el perfil arrendatario conservó sus permisos. En la portada, la foto de alianzas se cargó al llegar a la sección y «Proponer una alianza» llevó el asunto al formulario de contacto. Las dos vistas locales recibieron cinco cotizaciones con fecha. Se comprobó el recuadro de cuenta en móvil con fondo azul noche y texto blanco.

Pasaron las 47 pruebas de componentes, 31 de regresión y dos de arquitectura. Edge verificó el lienzo persistente de Bogotá, la iluminación del puntero y la alternativa sin WebGL. El catálogo superó las 20 comprobaciones de regresión y sus recorridos de filtros y foco con movimiento normal, reducido y sin JavaScript. La API y la web compilaron con Next.js 16.4.6 en el frontend.

## Nube jurídica y accesos de prueba de DEV

La cabecera de escritorio y el menú móvil enlazan «Compra y vende» con `/comprar`. La nube «IA jurídica» abre por teclado o toque y devuelve el foco al cerrar. `/consulta-juridica` ofrece el acceso a ChatGPT con contexto público colombiano y, con la API habilitada, consulta dentro de JB para cuentas autenticadas. El proveedor recibe la pregunta y usa búsqueda sobre dominios oficiales. Se exige una respuesta terminada con citas y se muestran sus enlaces. Las consultas predefinidas se eligen por identificador. Las preguntas libres requieren autorización y una política publicada en el entorno. La configuración vive en el servidor.

El lanzamiento sigue el flujo de PR, validación, Sonar y despliegue de la revisión aprobada a DEV. El lote opcional de pruebas crea cuentas sintéticas independientes de administrador, cliente de servicios y propietario. El operador entrega sus contraseñas fuera del repositorio. El alta es transaccional y la repetición del lote comprueba las identidades existentes.

### Criterios de aceptación de la nube y los perfiles

El acceso Compra y vende se prueba en el encabezado de escritorio y el menú móvil. Al cerrar la nube con Escape, el foco vuelve al botón que la abrió. Una respuesta con fuentes oficiales, un fallo seguido de reintento y el consentimiento se comprueban con un proveedor de ensayo. La prueba final del proveedor real se realiza en DEV con un tema predefinido. El administrador accede al editor y cada perfil de cliente o propietario ve su cuenta y vuelve a ella si intenta abrir la administración. La foto, el mapa y la navegación del carrusel se comprueban con teclado y con movimiento reducido.

**Resultado en Edge sobre DEV.** Pasaron el encabezado móvil y de escritorio, la apertura y el cierre de la nube, los permisos de los tres roles y las galerías y pines de las dos fichas de prueba. El recorrido autenticado mostró el estado de conexión pendiente para OpenAI. [Evidencia de despliegue](https://github.com/buitragopnicolas-prog/inmoviliaria/actions/runs/45789355274)

## Pinlau · Directorio público y equipo

Desde el encabezado de escritorio o el menú móvil, abrir Pinlau, elegir el área, desplegar un asunto y seguir su enlace a contacto. El título del asunto procede de su versión editorial vigente y acepta tanto el formulario con consentimiento como el correo de JB. En movimiento reducido, el texto y el foco permanecen estables al abrir las descripciones. El encuadre de Bogotá cambia al entrar y la escena persiste al pasar a contacto.

En Administración → Contenido del sitio → Pinlau · Presentación y equipo, añadir un perfil con nombre, cargo y retrato. Al añadir, el foco pasa al nombre. Al quitar, vuelve al siguiente perfil o al botón de alta. Publicar, comprobar la foto desde la página pública y comprobar que retirar el perfil lo oculta. Las seis áreas del directorio se editan desde esa misma navegación.

En Edge local se verificaron los 23 servicios, el menú móvil y de escritorio, el teclado, la persistencia del lienzo y el movimiento reducido. Una solicitud de procesos divisorios se recibió en Administración → Contactos con su asunto. Se publicó y retiró un perfil de ensayo con retrato y se comprobó el resultado desde la página pública. La política de prueba del sitio local se reutilizó en el editor local para verificar el envío con consentimiento.
