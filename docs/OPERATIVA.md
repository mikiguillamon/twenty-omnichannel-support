# Operación diaria de Omnichannel Support

## Revisar el Resumen

En **Omnichannel → Resumen** aparecen contadores de conversaciones registradas, atención humana pendiente, errores técnicos y evaluaciones incorrectas. Cada contador se lee por REST y puede fallar independientemente de los demás. Un valor no disponible no equivale a cero.

Selecciona **Personalizar indicadores** para elegir qué tarjetas mostrar en el workspace. Las gráficas por periodo, canal y categoría se crean en los dashboards nativos de Twenty.

## Gestionar conversaciones

Abre **Conversaciones** desde la administración de Omnichannel o desde un acceso del menú de Twenty. Pulsa el título para ver el historial en la bandeja. Desde el historial puedes cargar mensajes anteriores, consultar las grabaciones o transcripciones disponibles y abrir la ficha con **Abrir ficha**.

Combina la búsqueda por asunto o contacto con los filtros de canal, cuenta, estado, tipo, categoría, seguimiento y etiquetas. Pulsa una etiqueta de la tabla, usa **Etiquetas propias visibles** o escribe el nombre completo en **Etiqueta propia**. Si el tramo actual no tiene coincidencias y hay más registros, usa **Siguiente** para continuar la búsqueda.

Guarda la búsqueda, los filtros y el orden como una vista con nombre. **Añadir al menú** te permite elegir el nombre visible del acceso. Para cambiarlo después, entra en **Administración Omnichannel → Accesos**. Gestionar accesos compartidos requiere el permiso de diseños (`LAYOUTS`). El acceso a las conversaciones y a las vistas guardadas se rige por los permisos de sus objetos de Twenty.

Si n8n registra una propuesta de correo, encontrarás la respuesta editable en el historial. **Confirmar en n8n** reanuda la ejecución con el texto revisado. **Descartar** envía únicamente la decisión. El historial distingue la propuesta aprobada del correo enviado por el proveedor. [Configuración de n8n](INTEGRACION_N8N.md#revisar-una-respuesta-de-correo-en-twenty).

Para comunicaciones automatizadas, marca `AUTOMATED` o `INFORMATIONAL` cuando no hagan falta personas. Reserva `HUMAN_REQUIRED` para casos que requieren atención humana. Los otros estados son `NEW`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `WAITING_INTERNAL`, `RESOLVED` y `CLOSED`.

El seguimiento tiene su propio selector: `NONE`, `REQUIRED`, `SCHEDULED`, `WAITING_RESPONSE`, `IN_PROGRESS`, `COMPLETED` o `CANCELLED`. Utiliza `followUpAt` para la próxima fecha. `summary`, `comments` y `language` ayudan a mantener contexto sin mezclarlo con el contenido de los mensajes.

Los campos `resolution`, `automation` y `technicalStatus` son independientes del estado de atención. Un envío técnico correcto no significa que la incidencia esté resuelta.

## Responder desde una conversación

Debajo del historial de mensajes aparece **Responder**. Es un acceso directo al programa correspondiente, no un sistema de envío desde el CRM:

- **WhatsApp:** abre `wa.me` con el teléfono internacional de la conversación. Si no existe, intenta resolver un alias PN asociado a su identidad externa. Un LID por sí solo nunca se convierte en número.
- **Email:** abre la aplicación de correo predeterminada mediante `mailto:`, con la dirección del interlocutor y el asunto de la consulta prefijado por «Re:» cuando corresponde.
- **Telegram:** abre `t.me` únicamente si la identidad externa contiene un nombre de usuario público válido.
- **Instagram:** utiliza `ig.me/m` cuando la identidad contiene un nombre de usuario reconocible. Los IDs numéricos de proveedor no se consideran nombres de usuario.
- **Teléfono:** abre el marcador mediante `tel:` con un número internacional válido.

Cuando no hay un destino suficientemente fiable, el botón permanece deshabilitado y muestra el motivo. El enlace abre una app o web externa: **no envía mensajes, no actualiza el estado de la conversación ni registra automáticamente la respuesta en Twenty**. Para registrar envíos sigue siendo necesario que la integración de n8n/proveedor reporte el evento a la API de ingestión.

## Ver el historial de una Persona

Abre la ficha de Persona y entra en la pestaña **Omnichannel**. Encontrarás las conversaciones y las identidades externas que se han vinculado con seguridad. Si la integración no puede identificar a la Persona, la conversación sigue disponible en Omnichannel y su identidad externa puede consultarse por separado.

En WhatsApp se guardan los alias PN y LID dentro de la identidad correspondiente. Revisa las vinculaciones dudosas antes de asociar una identidad a una Persona.

## Llamadas y grabaciones

Un Canal `PHONE` permite registrar llamadas con transcripción por mensaje y por conversación. Las grabaciones aparecen como enlaces HTTPS al almacenamiento externo. Comprueba sus permisos de acceso antes de compartir el registro.

La app no realiza llamadas, no graba audio y no transcribe automáticamente. Esas acciones corresponden al proveedor de telefonía o al flujo de integración.

## Canales, FAQs y evaluaciones

En Canales puedes consultar el estado operativo y gestionar las políticas de agrupación. `ACTIVE` permite trabajar según la política externa, pero no garantiza conectividad del proveedor. Para frenar envíos, pausa el canal y asegúrate de que n8n consulta ese estado.

Mantén las FAQs con contenido revisado y categoría asignada cuando proceda. En el gestor puedes combinar los filtros de alcance, etiqueta y etiqueta propia. Una FAQ `PUBLISHED` puede ser utilizada por las automatizaciones; una `DRAFT` sigue pendiente de revisión. Registra las Evaluaciones de conversaciones o mensajes como trabajo de calidad, con su propio resultado y correcciones.

## API y resolución de problemas

La función `POST /s/omnichannel/v1/ingest` puede crear un mensaje nuevo y actualizar los metadatos de su conversación mediante el bloque `conversation`. Un evento `message.status` actualiza únicamente la entrega del mensaje original. Utiliza IDs estables para evitar duplicados.

Para errores de ingestión, revisa `reviewRequired`, el código devuelto por la API, permisos, canal, proveedor, cuenta e ID del mensaje. Consulta [API Reference](API_REFERENCE.md), [Integración n8n](INTEGRACION_N8N.md) y [Checklist de pruebas](CHECKLIST_PILOTO.md).
