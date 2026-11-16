# Operación diaria de Omnichannel Support

## Revisar el Resumen

En **Omnichannel → Resumen** aparecen contadores de conversaciones registradas, atención humana pendiente, errores técnicos y evaluaciones incorrectas. Cada contador se lee por REST y puede fallar independientemente de los demás. Un valor no disponible no equivale a cero.

Selecciona **Personalizar indicadores** para elegir qué tarjetas mostrar en el workspace. Las gráficas por periodo, canal y categoría se crean en los dashboards nativos de Twenty.

## Gestionar conversaciones

Abre **Omnichannel → Conversaciones**. Puedes filtrar por Canal, estado, categoría o fechas. En el detalle se muestran los datos de la conversación y una pestaña de mensajes ordenados, con enlaces a grabaciones y transcripciones cuando existen.

Para comunicaciones automatizadas, marca \`AUTOMATED\` o \`INFORMATIONAL\` cuando no hagan falta personas. Reserva \`HUMAN_REQUIRED\` para casos que requieren atención humana. Los otros estados son \`NEW\`, \`IN_PROGRESS\`, \`WAITING_CUSTOMER\`, \`WAITING_INTERNAL\`, \`RESOLVED\` y \`CLOSED\`.

El seguimiento tiene su propio selector: \`NONE\`, \`REQUIRED\`, \`SCHEDULED\`, \`WAITING_RESPONSE\`, \`IN_PROGRESS\`, \`COMPLETED\` o \`CANCELLED\`. Utiliza \`followUpAt\` para la próxima fecha. \`summary\`, \`comments\` y \`language\` ayudan a mantener contexto sin mezclarlo con el contenido de los mensajes.

Los campos \`resolution\`, \`automation\` y \`technicalStatus\` son independientes del estado de atención. Un envío técnico correcto no significa que la incidencia esté resuelta.

## Ver el historial de una Persona

Abre la ficha de Persona y entra en la pestaña **Omnichannel**. Encontrarás las conversaciones y las identidades externas que se han vinculado con seguridad. Si la integración no puede identificar a la Persona, la conversación sigue disponible en Omnichannel y su identidad externa puede consultarse por separado.

En WhatsApp se guardan los alias PN y LID dentro de la identidad correspondiente. Revisa las vinculaciones dudosas antes de asociar una identidad a una Persona.

## Llamadas y grabaciones

Un Canal \`PHONE\` permite registrar llamadas con transcripción por mensaje y por conversación. Las grabaciones aparecen como enlaces HTTPS al almacenamiento externo. Comprueba sus permisos de acceso antes de compartir el registro.

La app no realiza llamadas, no graba audio y no transcribe automáticamente. Esas acciones corresponden al proveedor de telefonía o al flujo de integración.

## Canales, FAQs y evaluaciones

En Canales puedes consultar el estado operativo y gestionar las políticas de agrupación. \`ACTIVE\` permite trabajar según la política externa, pero no garantiza conectividad del proveedor. Para frenar envíos, pausa el canal y asegúrate de que n8n consulta ese estado.

Mantén las FAQs con contenido revisado y categoría asignada cuando proceda. Una FAQ \`PUBLISHED\` puede ser utilizada por las automatizaciones; una \`DRAFT\` sigue pendiente de revisión. Registra las Evaluaciones de conversaciones o mensajes como trabajo de calidad, con su propio resultado y correcciones.

## API y resolución de problemas

La función \`POST /s/omnichannel/v1/ingest\` puede crear un mensaje nuevo y actualizar los metadatos de su conversación mediante el bloque \`conversation\`. Un evento \`message.status\` actualiza únicamente la entrega del mensaje original. Utiliza IDs estables para evitar duplicados.

Para errores de ingestión, revisa \`reviewRequired\`, el código devuelto por la API, permisos, canal, proveedor, cuenta e ID del mensaje. Consulta [API Reference](API_REFERENCE.md), [Integración n8n](INTEGRACION_N8N.md) y [Checklist de pruebas](CHECKLIST_PILOTO.md).
