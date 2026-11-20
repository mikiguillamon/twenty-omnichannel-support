# Dashboards Omnichannel

Omnichannel incluye su propio editor de dashboards para Twenty 2.50. No depende del editor de tableros nativo. La antigua entrada **Resumen** pasa a llamarse **Dashboards**; conserva los identificadores universales de la página y del componente para permitir la actualización sin reinstalación. Las tablas fijas de atención humana y errores técnicos dejan de ocupar espacio fuera del editor. Los objetos de conversaciones y mensajes no se alteran.

## Primer acceso y uso

Abre **Omnichannel → Dashboards** y selecciona **Crear visión general** para utilizar la plantilla inicial, o pulsa **Nuevo** para crear un dashboard vacío. En **Editar** puedes cambiar nombre y descripción, añadir widgets, reorganizarlos y definir una anchura de 3 a 12 columnas. Los botones de flechas permiten reordenar sin depender de arrastrar, compatible con el runtime de Front Components de Twenty. Pulsa **Guardar cambios** para persistir el diseño en el workspace. **Duplicar** crea un dashboard independiente; **Archivar** oculta la configuración, sin borrar registros de negocio.

Puedes elegir un origen de datos por widget: Conversaciones, Mensajes, Evaluaciones, Canales o FAQs. Cada fuente muestra los campos y dimensiones que la app admite. Tipos disponibles: KPI, barras, donut, líneas, áreas, tabla agregada, actividad por hora, acceso directo y texto. En cada widget puedes establecer título, agregación, campo numérico, dimensión, fecha de referencia y hasta cinco filtros exactos. El cálculo ratio presenta un porcentaje de registros coincidentes con un valor dentro del conjunto filtrado. El comparador muestra el período anterior con igual duración en la zona horaria del navegador.

El selector principal dispone de Hoy, Ayer, últimos 7/30/90 días, mes actual, mes anterior, todo y rango personalizado. La elección de fecha mientras estás fuera del editor puede guardarse mediante **Guardar período**; en modo edición se guarda junto con el dashboard. Un widget puede sobrescribir el período por defecto.

**Copiar JSON** exporta la configuración, e **Importar** permite crear una copia validada a partir de una exportación de esquema 2. No se exportan conversaciones ni credenciales.

## Arquitectura y datos

Cada dashboard se guarda en el objeto existente `supportSettings`, bajo la clave `omnichannel.dashboard.v2.<id>`, con el documento JSON en `valueText`. No hay base de datos adicional ni almacenamiento local del navegador. La lectura y las mutaciones utilizan la sesión autenticada del usuario y sus permisos REST de workspace. No aceptamos URLs arbitrarias como fuentes REST ni filtros definidos libremente sobre campos sensibles. Los enlaces de acceso directo se limitan a HTTPS y rutas internas, sin ejecución de JavaScript.

La lectura de las fuentes para gráficos se pagina con cursores, a 60 registros por página y un tope de 3.000 por fuente. Si hay más registros, **se ocultan los resultados como definitivos**, mostrando una advertencia de vista incompleta. Se evita así presentar agregados engañosos. Este límite es deliberado: para historiales grandes hay que implementar agregados del lado del servidor antes de incrementar el volumen soportado. Los gráficos son SVG/CSS sin librerías externas. Las métricas actuales son cortes basados en campos de cada objeto, no historiales de cambios de estado.

El período usa la fecha especificada en cada widget. Por ejemplo, `createdAt` agrupa conversaciones creadas, `firstMessageAt` conversaciones iniciadas, `lastMessageAt` actividad más reciente y `resolvedAt` resoluciones. El idioma de una llamada solamente se representa si llega en el campo que realmente almacena Omnichannel. Si no hay datos se muestra vacío o cero según el cálculo, y los errores de REST se distinguen de ambos estados.

## Límites actuales y próximos pasos

- La navegación de la app sigue teniendo una sola entrada **Dashboards**; los distintos paneles se eligen con el selector integrado. Las entradas dinámicas por dashboard en la barra lateral dependen de capacidades de navegación que no se han verificado en Twenty 2.50.
- El orden se cambia con botones y la anchura mediante selector de columnas; no se incluye drag-and-drop.
- La configuración se comparte por workspace. Los permisos detallados para compartir dashboards con individuos o equipos y una autoría auditable no están implementados.
- Para series muy largas, comparaciones con el período anterior y grandes datasets es necesario un endpoint de agregación seguro en el servidor. El motor actual trabaja con lecturas paginadas y un límite estricto.
- No se realizan cambios sobre los datos de negocio ni se instalan automatismos de actualización externa.

## Resolución de problemas

Si no se carga la lista, revisa los permisos del objeto `supportSettings`. Si una fuente falla, comprueba el campo y la petición correspondiente en la pestaña de red. Si el dashboard indica más de 3.000 registros, no interpretes gráficos parciales como resultados completos: utiliza un rango más pequeño únicamente cuando la API pueda filtrar ese rango en origen o migra los agregados al servidor. Si una versión del cliente SDK rechaza el campo de relación en `fields`, corrige la selección de columnas en el catálogo de `src/lib/dashboard-model.ts` antes de publicar.

## Pruebas

`corepack yarn check` comprueba esquema, TypeScript y compilación del SDK; `corepack yarn test` verifica el motor de fechas, filtros, ratios, configuraciones e importación. El workflow CI ejecuta ambos comandos antes de la publicación.
