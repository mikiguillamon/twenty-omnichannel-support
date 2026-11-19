# Gestor visual de FAQs

Omnichannel → **FAQs** abre un listado visual de preguntas frecuentes con tarjetas, agrupación por categoría y un editor de contenido. **FAQs (tabla)** mantiene el acceso al listado de registros original de Twenty y sus vistas guardadas.

## Uso diario

1. Selecciona **FAQs** en el menú de Omnichannel. El encabezado muestra el total, las publicadas y los borradores.
2. Busca por pregunta, respuesta o variantes. Combina la búsqueda con Estado, Idioma y Alcance. Las FAQs archivadas quedan ocultas en el filtro inicial, pero puedes mostrarlas.
3. Usa **Nueva FAQ** o **Editar**. El formulario principal tiene categoría, idioma, estado, pregunta y respuesta. **Mostrar opciones avanzadas** ofrece alcance, variantes, etiquetas y URL de referencia sin ocultar ni sobrescribir datos durante una edición.
4. Guarda la FAQ. La vista se vuelve a cargar desde la API y conserva tus filtros.
5. Usa el interruptor para publicar o volver a borrador. **Archivar** pide confirmación, conserva el registro y permite restaurarlo desde el filtro Archivadas.

## Cómo funciona

El frontend usa el SDK de Twenty 2.50: una página \`STANDALONE_PAGE\`, un widget \`FRONT_COMPONENT\` y \`RestApiClient()\` con la sesión del usuario. Nunca usa \`runAs: 'application'\` para administración. Los permisos de lectura y escritura se comprueban en Twenty. No almacena tokens ni reproduce registros en otra base de datos.

Las categorías son los registros existentes \`supportCategories\`. La columna de relación se consulta con \`depth: 0\`, que devuelve \`categoryId\` en Twenty 2.50. Se cargan todos los registros mediante cursores opacos de REST (hasta 3000 FAQs o categorías por recurso) para aplicar filtros completos en el navegador; el botón **Mostrar más FAQs** solo controla la presentación. Si la carga falla o excede el límite, se muestra error, sin insinuar que la lista esté completa.

Los cambios afectan a \`supportFaqs\` mediante REST. No se modifica la búsqueda \`POST /s/omnichannel/v1/faqs/search\`: esta sigue ofreciendo únicamente respuestas publicadas y dentro del alcance solicitado. Las FAQs sin alcance no se ofrecen a los bots. Para la publicación desde este editor conviene seleccionar \`GENERAL\` u otro alcance apropiado; no se asigna \`GENERAL\` automáticamente a registros existentes.

## Limitaciones de Twenty 2.50

La aplicación no renderiza diálogos propios: los formularios se editan dentro de la página y la confirmación de archivo utiliza el modal gestionado por el host. La tabla nativa sigue siendo la opción para operaciones masivas y ajustes de columnas. No se elimina ningún registro desde el gestor. Las nuevas FAQs se crean como borrador en catalán por defecto, con alcance GENERAL modificable; al editar, todos los valores se toman del registro existente.

## Actualización

La beta.22 solo añade interfaz, navegación, pruebas y documentación: los UUID universales y el modelo de datos permanecen sin cambios. Actualiza la app instalada desde el Marketplace sin desinstalarla, y comprueba primero con un workspace de pruebas. La publicación del paquete en npm y la sincronización del Marketplace son procesos distintos.
