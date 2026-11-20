# Gestor visual de FAQs

Omnichannel → **FAQs** abre un listado visual de preguntas frecuentes con tarjetas, agrupación por categoría y un editor de contenido en el panel lateral nativo de Twenty. **FAQs (tabla)** mantiene el acceso al listado de registros original de Twenty y sus vistas guardadas.

## Uso diario

1. Selecciona **FAQs** en el menú de Omnichannel. El encabezado muestra el total, las publicadas y los borradores.
2. Busca por pregunta, respuesta o variantes. Combina la búsqueda con Estado, Idioma y Alcance. Las FAQs archivadas quedan ocultas en el filtro inicial, pero puedes mostrarlas.
3. Usa **Nueva FAQ** o el icono del lápiz. Se abre el editor en el panel lateral nativo (sin desplazar las tarjetas). El formulario principal tiene categoría, idioma, estado, pregunta y respuesta. **Mostrar opciones avanzadas** ofrece alcance, variantes, etiquetas y URL de referencia sin ocultar ni sobrescribir datos durante una edición.
4. Guarda la FAQ en el panel. Twenty confirma el cambio y cierra el panel. Pulsa **Actualizar** en el gestor para recargar datos conservando tus filtros.
5. Usa el interruptor **Activa** para publicar o devolver a borrador. El icono de archivo pide confirmación, conserva el registro y permite restaurarlo desde el filtro Archivadas. Las FAQs archivadas requieren restauración antes de activarlas.

## Cómo funciona

El frontend usa el SDK de Twenty 2.50: una página \`STANDALONE_PAGE\`, un widget \`FRONT_COMPONENT\` y \`RestApiClient()\` con la sesión del usuario. Nunca usa \`runAs: 'application'\` para administración. Los permisos de lectura y escritura se comprueban en Twenty. No almacena tokens ni reproduce registros en otra base de datos.

Las categorías son los registros existentes \`supportCategories\`. La columna de relación se consulta con \`depth: 0\`, que devuelve \`categoryId\` en Twenty 2.50. Se cargan todos los registros mediante cursores opacos de REST (hasta 3000 FAQs o categorías por recurso) para aplicar filtros completos en el navegador; el botón **Mostrar más FAQs** solo controla la presentación. Si la carga falla o excede el límite, se muestra error, sin insinuar que la lista esté completa.

Los cambios afectan a \`supportFaqs\` mediante REST. No se modifica la búsqueda \`POST /s/omnichannel/v1/faqs/search\`: esta sigue ofreciendo únicamente respuestas publicadas y dentro del alcance solicitado. Las FAQs sin alcance no se ofrecen a los bots. Para la publicación desde este editor conviene seleccionar \`GENERAL\` u otro alcance apropiado; no se asigna \`GENERAL\` automáticamente a registros existentes.

## Limitaciones de Twenty 2.50

La aplicación no renderiza diálogos propios: los formularios de creación y edición se abren en el **panel lateral nativo de Twenty**, mediante `openSidePanelPage` y `SidePanelPages.ViewFrontComponent`. La confirmación de archivo sigue utilizando el modal gestionado por el host. La tabla nativa sigue siendo la opción para operaciones masivas y ajustes de columnas. No se elimina ningún registro desde el gestor. Las nuevas FAQs se crean como borrador en catalán por defecto, con alcance GENERAL modificable; al editar, todos los valores se toman del registro existente.

## Actualización

La beta.23 corrige la actualización de navegación rechazada por Twenty 2.50. Conserva la entrada de menú original como OBJETO y crea otra para la página visual. No necesitas desinstalar Omnichannel Support. La beta.22 solo añadía interfaz, navegación, pruebas y documentación: los UUID universales y el modelo de datos permanecen sin cambios. Actualiza la app instalada desde el Marketplace sin desinstalarla, y comprueba primero con un workspace de pruebas. La publicación del paquete en npm y la sincronización del Marketplace son procesos distintos.
