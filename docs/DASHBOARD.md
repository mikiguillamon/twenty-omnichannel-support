# Dashboards Omnichannel

Omnichannel incluye su propio editor de dashboards para Twenty 2.50. No depende del editor de tableros nativo. La antigua entrada **Resumen** pasa a llamarse **Dashboards**; conserva los identificadores universales de la página y del componente para permitir la actualización sin reinstalación. Las tablas fijas de atención humana y errores técnicos dejan de ocupar espacio fuera del editor. Los objetos de conversaciones y mensajes no se alteran.

## Primer acceso y uso

Abre **Omnichannel → Dashboards** y selecciona **Crear visión general** para utilizar la plantilla inicial, o pulsa **Nuevo** para crear un dashboard vacío. En **Editar** puedes cambiar nombre y descripción, añadir widgets, reorganizarlos y definir una anchura de 3 a 12 columnas. Los widgets se pueden **reordenar arrastrando su cabecera** sobre otra tarjeta. La tarjeta de destino se resalta y el cambio se refleja en el borrador; pulsa **Guardar cambios** para persistirlo. También están disponibles los botones ←/→ y las flechas del teclado sobre el asa como alternativa accesible. Arrastra la esquina inferior derecha para cambiar anchura y altura de un widget. También puedes hacerlo desde **Configurar** mediante selectores de tamaño. El editor conserva los datos y opciones anteriores. Los dashboards v2 existentes obtienen una altura predeterminada al leerse; no cambia el identificador del dashboard, la clave de guardado ni sus enlaces. Pulsa **Guardar cambios** para persistir el diseño en el workspace. **Duplicar** crea un dashboard independiente; **Archivar** oculta la configuración, sin borrar registros de negocio.

Puedes elegir un origen de datos por widget: Conversaciones, Mensajes, Evaluaciones, Canales o FAQs. Cada fuente muestra los campos y dimensiones que la app admite. Tipos disponibles: KPI, barras, donut, líneas, áreas, tabla agregada, actividad por hora, acceso directo y texto. En cada widget puedes establecer título, agregación, campo numérico, dimensión, fecha de referencia y hasta cinco filtros exactos. El cálculo ratio presenta un porcentaje de registros coincidentes con un valor dentro del conjunto filtrado. El comparador muestra el período anterior con igual duración en la zona horaria del navegador.

El selector principal dispone de Hoy, Ayer, últimos 7/30/90 días, mes actual, mes anterior, todo y rango personalizado. La elección de fecha mientras estás fuera del editor puede guardarse mediante **Guardar período**; en modo edición se guarda junto con el dashboard. Un widget puede sobrescribir el período por defecto.

**Copiar JSON** exporta la configuración, e **Importar** permite crear una copia validada a partir de una exportación de esquema 2. No se exportan conversaciones ni credenciales.

## Arquitectura y datos

Cada dashboard se guarda en el objeto existente `supportSettings`, bajo la clave `omnichannel.dashboard.v2.<id>`, con el documento JSON en `valueText`. No hay base de datos adicional ni almacenamiento local del navegador. La lectura y las mutaciones utilizan la sesión autenticada del usuario y sus permisos REST de workspace. No aceptamos URLs arbitrarias como fuentes REST ni filtros definidos libremente sobre campos sensibles. Los enlaces de acceso directo se limitan a HTTPS y rutas internas, sin ejecución de JavaScript.

La lectura de las fuentes para gráficos se pagina con cursores, a 60 registros por página y un tope de 3.000 por fuente. Si hay más registros, **se ocultan los resultados como definitivos**, mostrando una advertencia de vista incompleta. Se evita así presentar agregados engañosos. Este límite es deliberado: para historiales grandes hay que implementar agregados del lado del servidor antes de incrementar el volumen soportado. Los gráficos son SVG/CSS sin librerías externas, preparados para el renderer aislado del SDK de Twenty 2.50. El diseño incluye ejes con escala, marcas temporales y detalles por punto en series, barras con leyenda numérica, horas agrupadas en 24 columnas, donuts con porcentajes y categoría «Otros», tablas de datos, estados sin registros y skeletons durante la carga. Se evita introducir ECharts, d3 o Gridstack porque dependen de capacidades de DOM que no proporciona de forma general un Front Component. Las métricas actuales son cortes basados en campos de cada objeto, no historiales de cambios de estado.

El período usa la fecha especificada en cada widget. Por ejemplo, `createdAt` agrupa conversaciones creadas, `firstMessageAt` conversaciones iniciadas, `lastMessageAt` actividad más reciente y `resolvedAt` resoluciones. El idioma de una llamada solamente se representa si llega en el campo que realmente almacena Omnichannel. Si no hay datos se muestra vacío o cero según el cálculo, y los errores de REST se distinguen de ambos estados.

## Límites actuales y próximos pasos

- **Consejo de navegación:** copia la ruta interna que comienza por `/page/`. Twenty reconoce estas rutas como navegación de la propia aplicación; una URL absoluta de otro sitio se trata como enlace externo.
- **Accesos individuales en la barra lateral de Twenty:** abre un dashboard y pulsa **Copiar enlace**. En el menú de Twenty utiliza la opción nativa de edición de la barra lateral para añadir un **enlace personalizado** con la URL copiada. Así puedes poner varios dashboards en la raíz, Favoritos o dentro de una carpeta según admita la versión instalada de Twenty. El destino incluye `?omniDashboard=<id>`, que la app lee para seleccionar el dashboard guardado en el workspace. **No se crean ni mueven entradas en el menú automáticamente**, porque los elementos declarados en el manifiesto de una app son estáticos y la configuración de dashboards es dinámica por workspace. Para un dashboard archivado, el enlace seguirá existiendo pero no encontrará el panel hasta que se restaure.
- **Drag & drop:** disponible en modo edición mediante eventos de puntero del renderer. Para entornos que no transmitan correctamente el puntero, el movimiento por flechas continúa disponible. La anchura se ajusta a 3, 4, 6, 8 o 12 columnas y la altura a 2–12 filas mediante el tirador de esquina o los selectores; no se introducen dependencias de DOM que puedan romper la app. La edición incorpora un tirador en la esquina inferior derecha para redimensionar alto y ancho, ajustándose a tamaños discretos de la cuadrícula. La configuración lateral también ofrece selectores de tamaño como alternativa accesible. Los widgets se reordenan arrastrando su cabecera; los botones de ordenación y tamaño desaparecen de cada tarjeta.
- La configuración se comparte por workspace. Los permisos detallados para compartir dashboards con individuos o equipos y una autoría auditable no están implementados.
- Para series muy largas, comparaciones con el período anterior y grandes datasets es necesario un endpoint de agregación seguro en el servidor. El motor actual trabaja con lecturas paginadas y un límite estricto.
- No se realizan cambios sobre los datos de negocio ni se instalan automatismos de actualización externa.

## Qué cambia en esta actualización

La nueva experiencia de gráficos y editor se aplica a los dashboards existentes sin migración de esquema. No se alteran las fuentes, filtros, períodos ni UUID de navegación que usa Twenty 2.50. Los toggles del gestor de FAQs se guardan con actualizaciones optimistas por tarjeta, conservando el scroll, los filtros activos y las respuestas desplegadas. Si falla la API, solo esa tarjeta recupera el estado anterior y aparece el error, sin volver a cargar las 107 (o más) FAQs del workspace.


## Administración en la versión posterior a 1.0.0

El centro de administración usa ahora una distribución horizontal adaptable: las secciones se muestran como pestañas y el editor ocupa todo el ancho disponible dentro del contenedor que Twenty ofrece en Ajustes. Esto elimina la columna lateral fija de 200 píxeles, pero **no elimina el límite de ancho impuesto por el propio host de Ajustes**. Si Twenty renderiza el Front Component en un panel estrecho, ampliar ese contenedor requerirá una ruta operativa de página completa o una modificación compatible del core.

En la pestaña Dashboards, **Ver instrucciones** explica cómo publicar un enlace compartido desde el editor nativo del menú. No es un botón de publicación automática: el SDK 2.50 no garantiza una API pública para crear enlaces de navegación administrados por el workspace. No se fabrican mutaciones de metadatos sin confirmar el contrato, ni se crean enlaces bajo una carpeta propiedad de la aplicación. Los permisos siguen siendo los de Twenty.

## Gestor de accesos compartidos (rama en revisión)

La administración incluye ahora un gestor de accesos de dashboards que utiliza las mutaciones de metadatos de navegación de Twenty: crear, renombrar y retirar enlaces `LINK` compartidos en la raíz del workspace. Solo acepta rutas internas `/page/...` con un único parámetro `omniDashboard` al crear el acceso. Los enlaces creados por este gestor incorporan `omniShortcut=managed-v1` para distinguirlos de enlaces manuales. Impide duplicar destinos y verifica de nuevo la propiedad del enlace antes de modificarlo. Retirar un acceso no elimina el dashboard ni sus registros. Estos enlaces no están asociados al `applicationId` de Omnichannel, por lo que no dependen de la carpeta técnica eliminada en 1.0.0.

**Pendiente de validación antes de publicar:** compilar contra `twenty-client-sdk@2.50.0` y comprobar en una instancia Twenty 2.50 la firma real de las mutaciones, su autorización administrativa y que la navegación se actualiza al crear o borrar un elemento. El panel de Ajustes sigue sujeto al ancho que le asigna Twenty. No se ha publicado todavía en npm ni se recomienda activar la rama en producción.

## Resolución de problemas

Si no se carga la lista, revisa los permisos del objeto `supportSettings`. Si una fuente falla, comprueba el campo y la petición correspondiente en la pestaña de red. Si el dashboard indica más de 3.000 registros, no interpretes gráficos parciales como resultados completos: utiliza un rango más pequeño únicamente cuando la API pueda filtrar ese rango en origen o migra los agregados al servidor. Si una versión del cliente SDK rechaza el campo de relación en `fields`, corrige la selección de columnas en el catálogo de `src/lib/dashboard-model.ts` antes de publicar.

## Pruebas

`corepack yarn check` comprueba esquema, TypeScript y compilación del SDK; `corepack yarn test` verifica el motor de fechas, filtros, ratios, configuraciones e importación. El workflow CI ejecuta ambos comandos antes de la publicación.


## Preparación de la versión 1.0.0

El nuevo layout bidimensional es **compatible con los registros existentes**. Se añade el campo opcional `height` a la representación de cada widget; las versiones anteriores sin ese campo se normalizan al cargarse y conservan su identificador y filtros. La clave `omnichannel.dashboard.v2.<id>` y la estructura exportada de esquema 2 no cambian. La versión 1.0.0 utiliza el nuevo objeto `supportDashboards` y permite copiar los registros heredados desde `supportSettings` mediante la acción **Migrar dashboards antiguos** en el centro de administración. Los originales no se borran: esta migración es repetible y conserva los IDs.

La aplicación no publica automáticamente accesos en el menú principal: los enlaces de usuario permanecen bajo control del workspace. Un futuro aislamiento administrativo debe preservar esos enlaces y comprobar en Twenty el control de visibilidad por rol, que no está presente en el manifiesto de navegación del SDK 2.50.


## Acceso por roles y migración desde la beta

Los dashboards nuevos se guardan en el objeto `supportDashboards`, independiente de `supportSettings`. Para que los usuarios no Admin puedan visualizarlos, concede a sus roles de Twenty permiso de lectura sobre **Dashboards de soporte** y los objetos de datos que alimentan sus widgets; no concedas acceso a **Ajustes de soporte** solo para usar dashboards. El editor necesita permiso de escritura sobre `supportDashboards`.

Tras actualizar desde una beta, entra con un usuario Admin en **Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel → Dashboards** y pulsa **Migrar dashboards antiguos**. Verifica que aparece la cantidad de dashboards copiados; repetir la operación no genera duplicados. Los registros anteriores se conservan para recuperación y los nuevos prevalecen cuando ambos tengan el mismo ID. Después, comprueba un dashboard desde una cuenta Member con permisos mínimos.
