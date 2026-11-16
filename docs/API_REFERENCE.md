# Referencia de API: Omnichannel Support

Contrato de integración de Omnichannel Support para Twenty CRM 2.50. Se corresponde con el código de la app **0.3.0-beta.12**. Los ejemplos usan datos ficticios.

El servicio de ingestión recibe eventos normalizados de proveedores de correo, mensajería y telefonía. Los adaptadores de n8n, Make o un servicio propio preparan esos eventos, mientras Twenty guarda la conversación y los mensajes. La API de registros de Twenty sigue disponible para consultar y editar las entidades.

## Requisitos y autenticación

- Instala la app en el workspace de destino. La compatibilidad declarada del paquete es Twenty \`>=2.50.0 <2.51.0\` y Node \`^24.5.0\`.
- Crea un Canal en ese workspace con un \`code\` único, \`channelType\` y, cuando corresponda, \`provider\` y \`externalIdentifier\`.
- Usa una credencial Bearer del workspace con permisos suficientes. No incluyas tokens en el cuerpo de la petición, campos de Ajustes, URLs ni logs.
- La función se registra como ruta HTTP autenticada con \`POST\`, \`isAuthRequired: true\` y \`timeoutSeconds: 30\`. La ruta configurada en la app es \`/omnichannel/v1/ingest\`; la URL externa documentada para Twenty 2.50 suele ser:

\`\`\`http
POST https://TWENTY_HOST/s/omnichannel/v1/ingest
Authorization: Bearer WORKSPACE_API_TOKEN
Content-Type: application/json
\`\`\`

Confirma la URL real de la función y su resolución de workspace en la instalación antes de poner en marcha un flujo. La autenticación y autorización pueden devolver \`401\` o \`403\` desde Twenty antes de ejecutar el handler.

El handler rechaza cuerpos \`rawBody\` de más de **256.000 bytes** con \`413 PAYLOAD_TOO_LARGE\`. Sus respuestas incluyen \`Cache-Control: no-store\`. El límite de ejecución es de 30 segundos.

## POST /omnichannel/v1/ingest

La petición acepta un objeto JSON. Puedes enviar datos modernos dentro de \`contact\`, \`message\` y \`conversation\`; se conservan ciertos campos planos por compatibilidad con integraciones anteriores.

### Campos de nivel superior

| Campo | Tipo | Cómo se utiliza |
| --- | --- | --- |
| \`channelCode\` | string, obligatorio | Código del Canal, convertido a minúsculas, máximo 120 caracteres. Debe existir en el workspace. |
| \`channelType\` | enum, opcional | \`EMAIL\`, \`WHATSAPP\`, \`INSTAGRAM\`, \`TELEGRAM\`, \`PHONE\`. Si se envía, debe coincidir con el Canal. |
| \`provider\` | string, opcional | Identificador del proveedor, convertido a minúsculas, máximo 120 caracteres. Si el Canal declara uno, debe coincidir. |
| \`accountId\` | string, opcional | ID de cuenta, buzón o línea, convertido a minúsculas, máximo 300 caracteres. También admite \`account\`. Si se omite, se utiliza \`channel.externalIdentifier\`. |
| \`eventType\` | enum, opcional | \`message.received\`, \`message.sent\`, \`message.status\`. Se infiere como recibido o enviado a partir de la dirección cuando se omite. |
| \`contact\` | object, opcional | Identidad del interlocutor y vínculo opcional con Persona. |
| \`message\` | object, opcional | Mensaje nuevo o notificación de entrega. Hay campos planos equivalentes para compatibilidad. |
| \`conversation\` | object, opcional | Cambios a aplicar a la conversación al registrar un mensaje nuevo. No es un endpoint de edición independiente. |

El ámbito de las claves externas se deriva de \`channelType:provider:accountId\`. Una misma ID de proveedor puede utilizarse en cuentas distintas sin colisionar.

### Contacto (\`contact\`)

| Campo | Tipo | Regla |
| --- | --- | --- |
| \`externalId\` o \`externalUserId\` | string | ID estable del usuario en el proveedor. También se admite \`externalUserId\` en la raíz. Se normaliza a minúsculas, máximo 300 caracteres. |
| \`email\` | string | Dirección de correo validada; se normaliza a minúsculas. Alternativa plana: \`customerEmail\`. Para email puede derivarse del remitente o destinatario según la dirección. |
| \`phone\` | string | Número de origen, máximo 80 caracteres; alternativa \`originPhone\` en raíz. El endpoint no valida E.164 ni fusiona Personas por teléfono. |
| \`name\` | string | Nombre visible, máximo 500 caracteres; alternativa \`displayName\` en raíz. |
| \`personId\` | string | UUID de Persona de Twenty. Solo se usa para vinculación directa cuando \`verified: true\`. |
| \`verified\` | boolean | Señal explícita de comprobación del interlocutor; \`true\` habilita la búsqueda o vinculación segura de Persona para canales que no son email. |
| \`remoteJid\`, \`remoteJidAlt\` | string | Direcciones de WhatsApp PN y LID. También se admiten en \`message\` y en raíz; se convierten en alias de identidad cuando son válidas. |

Para \`EMAIL\`, la app puede encontrar o crear una Persona por correo electrónico. En los demás canales necesita \`verified: true\` y evidencia suficiente. Una identidad externa puede existir sin Persona. Ante coincidencias múltiples o alias incompatibles, la vinculación pasa a revisión.

### Mensaje (\`message\`)

| Campo | Tipo | Regla y alternativa |
| --- | --- | --- |
| \`externalId\` | string | ID del evento/mensaje del proveedor, máximo 300 caracteres. También \`messageId\`, \`providerMessageId\` o sus alternativas planas. |
| \`idempotencyKey\` | string | Clave estable alternativa si no hay ID del proveedor, máximo 300 caracteres. También se admite en raíz. |
| \`direction\` | enum | \`INBOUND\` o \`OUTBOUND\`. Por defecto \`INBOUND\`, excepto \`message.sent\`. |
| \`senderType\` | enum | \`CUSTOMER\`, \`BOT\`, \`AGENT\`. Predeterminado: cliente en entrada, agente en salida. |
| \`deliveryStatus\` | enum | \`RECEIVED\`, \`PENDING\`, \`SENT\`, \`DELIVERED\`, \`FAILED\`. Predeterminado: \`RECEIVED\` en entradas y \`PENDING\` en salidas, salvo \`message.sent\` que presume \`SENT\` si se omite. |
| \`body\` o \`text\` | string | Texto, máximo 100.000 caracteres. Si está vacío, el registro usa el marcador \`[Message without text or with attachment]\`. Alternativa \`body\` en raíz. |
| \`subject\` | string | Asunto, máximo 500 caracteres. Valor predeterminado: \`Support enquiry\`. Alternativa en raíz. |
| \`fromAddress\` o \`from\` | string | Origen, máximo 500 caracteres. Alternativa \`fromAddress\` en raíz. |
| \`toAddress\` o \`to\` | string | Destino, máximo 500 caracteres. Alternativa \`toAddress\` en raíz. |
| \`occurredAt\` | ISO 8601 | Fecha real del evento. Si se omite, se utiliza la hora de procesamiento. Alternativa plana. |
| \`threadId\` | string | Hilo del proveedor, máximo 350 caracteres. Alternativa plana. Es especialmente útil para \`THREAD\`. |
| \`issueKey\` | string | Referencia del asunto, máximo 350 caracteres. Alternativa plana; reutilízala al continuar una conversación. |
| \`caseId\` | string | ID de \`supportCase\` existente. Alternativa plana. El servidor verifica que sea coherente con Canal e identidad. |
| \`replyToExternalId\` | string | ID del mensaje del proveedor al que se responde, máximo 300 caracteres; alternativa \`replyToMessageId\` en raíz. |
| \`providerChatId\` | string | Dirección de chat original, máximo 300 caracteres; alternativa \`remoteJid\` en raíz. |
| \`providerChatIdAlt\` | string | Dirección alternativa, máximo 300 caracteres; alternativa \`remoteJidAlt\` en raíz. |
| \`providerAddressingMode\` | string | Contexto de direccionamiento del proveedor, máximo 80 caracteres. Alternativa plana. |
| \`remoteJid\`, \`remoteJidAlt\` | string | También se utilizan para descubrir alias WhatsApp, como en \`contact\`. |
| \`callTranscription\` | string o null | Transcripción del mensaje o llamada, máximo 100.000 caracteres. Se guarda en \`supportMessages.callTranscription\` si contiene texto. |
| \`callRecordingUrl\` | string o null | URL HTTPS de audio, máximo 2.048 caracteres, sin usuario/contraseña en la URL. Se guarda como \`LINKS\` en \`supportMessages.callRecording\`. |

Si no envías \`externalId\` ni \`idempotencyKey\`, el servidor genera una clave distinta para esa petición y responde \`stableId: false\`. **Los reintentos no quedan deduplicados** en ese caso. En producción conviene aportar siempre un ID estable por mensaje.

### Conversación (\`conversation\`)

Los siguientes campos pueden enviarse tanto con el primer mensaje como con uno nuevo que se incorpore a la conversación. Un campo omitido conserva el valor actual. Los campos con \`null\` admitido se pueden limpiar expresamente.

| Campo | Tipo | Comportamiento |
| --- | --- | --- |
| \`status\` | enum | \`NEW\`, \`IN_PROGRESS\`, \`WAITING_CUSTOMER\`, \`HUMAN_REQUIRED\`, \`RESOLVED\`, \`CLOSED\`, \`AUTOMATED\`, \`INFORMATIONAL\`, \`WAITING_INTERNAL\`. |
| \`followUp\` | enum o null | \`NONE\`, \`REQUIRED\`, \`SCHEDULED\`, \`WAITING_RESPONSE\`, \`IN_PROGRESS\`, \`COMPLETED\`, \`CANCELLED\`. |
| \`followUpAt\` | ISO 8601 o null | Fecha y hora del seguimiento; exige zona horaria \`Z\` u offset y se normaliza a UTC. |
| \`categoryId\` | UUID o null | Categoría ya creada en el workspace. |
| \`categoryCode\` | string o null | Código exacto, con distinción de mayúsculas, de categoría existente. No envíes \`categoryId\` y \`categoryCode\` juntos. |
| \`summary\` | string o null | Resumen libre, máximo 100.000 caracteres. |
| \`comments\` | string o null | Comentarios operativos, máximo 100.000 caracteres. |
| \`language\` | string o null | Etiqueta de idioma, por ejemplo \`es\`, \`ca\`, \`en\` o \`es-ES\`. Máximo 48 caracteres, validación sintáctica tipo BCP 47. |
| \`transcription\` | string o null | Transcripción a nivel conversación, máximo 100.000 caracteres. |
| \`recordingUrl\` | string o null | Enlace HTTPS a la grabación, máximo 2.048 caracteres. Se transforma al campo \`LINKS\` \`supportCases.recording\`. |

La categoría debe existir y no estar desactivada (\`enabled: false\`). Si se detecta ambigüedad de identidad o agrupación y se crea una conversación nueva para revisión, la app fuerza \`HUMAN_REQUIRED\`, incluso si el evento solicitaba otro estado.

Los estados de la conversación son distintos de \`deliveryStatus\` (envío del mensaje), \`resolution\` (resultado del caso) y \`technicalStatus\` (funcionamiento del bot). El bloque \`conversation\` no admite claves arbitrarias ni valores anidados adicionales.

Una petición \`message.status\` no admite un bloque \`conversation\` con cambios. Para editar solo la conversación, usa la API REST estándar de Twenty, con los permisos correspondientes: \`PATCH /rest/supportCases/{id}\`.

## Ejemplos completos

### Crear una conversación de email

\`\`\`json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "contact": { "email": "cliente@example.com", "name": "Alex García" },
  "message": {
    "externalId": "msg-001",
    "threadId": "thread-120",
    "direction": "INBOUND",
    "fromAddress": "cliente@example.com",
    "toAddress": "soporte@example.com",
    "subject": "Consulta sobre pedido",
    "body": "Quiero consultar el estado de mi pedido."
  },
  "conversation": {
    "status": "IN_PROGRESS",
    "categoryCode": "PEDIDOS",
    "language": "es"
  }
}
\`\`\`

Para añadir una respuesta al mismo hilo, mantén \`threadId: "thread-120"\` y usa otro \`message.externalId\`:

\`\`\`json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "contact": { "email": "cliente@example.com" },
  "message": {
    "externalId": "msg-002",
    "threadId": "thread-120",
    "direction": "OUTBOUND",
    "senderType": "BOT",
    "deliveryStatus": "SENT",
    "body": "Te hemos enviado la información."
  },
  "conversation": {
    "status": "AUTOMATED",
    "followUp": "NONE",
    "summary": "Se ha respondido con la información solicitada."
  }
}
\`\`\`

En un Canal \`THREAD\`, el segundo mensaje puede compartir conversación con el primero si supera las comprobaciones de titularidad. El estado cambia al procesar el mensaje **nuevo**. Reenviar \`msg-002\` devuelve \`duplicate\` y no vuelve a sobrescribir el estado.

### Confirmar la entrega de un mensaje

\`\`\`json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "eventType": "message.status",
  "message": {
    "externalId": "msg-002",
    "deliveryStatus": "DELIVERED"
  }
}
\`\`\`

El evento busca un mensaje existente y actualiza su entrega sin crear otro. No envíes \`conversation\` en esta operación.

### WhatsApp con PN y LID

\`\`\`json
{
  "channelCode": "whatsapp-soporte",
  "channelType": "WHATSAPP",
  "provider": "evolution",
  "accountId": "numero-1",
  "contact": {
    "externalId": "34600111222@s.whatsapp.net",
    "remoteJid": "2323232323@lid",
    "remoteJidAlt": "34600111222@s.whatsapp.net"
  },
  "message": {
    "externalId": "wamid-010",
    "issueKey": "pedido-2244",
    "body": "¿Habéis recibido mi pedido?"
  },
  "conversation": {
    "status": "IN_PROGRESS",
    "followUp": "REQUIRED"
  }
}
\`\`\`

Los JID y LID se guardan como alias observados de una identidad externa. Los grupos de WhatsApp \`@g.us\` están excluidos de este endpoint. No se vincula una Persona por teléfono sin evidencia verificada.

### Llamada telefónica

\`\`\`json
{
  "channelCode": "telefono-centralita",
  "channelType": "PHONE",
  "provider": "voip",
  "accountId": "linea-1",
  "contact": { "externalId": "caller-100", "name": "Cliente" },
  "message": {
    "externalId": "call-001",
    "issueKey": "consulta-telefonica-001",
    "direction": "INBOUND",
    "body": "Llamada recibida",
    "callTranscription": "Buenos días, llamo para consultar una factura.",
    "callRecordingUrl": "https://recordings.example.com/call-001"
  },
  "conversation": {
    "status": "WAITING_INTERNAL",
    "followUp": "REQUIRED",
    "language": "es",
    "transcription": "Buenos días, llamo para consultar una factura.",
    "recordingUrl": "https://recordings.example.com/call-001"
  }
}
\`\`\`

La app registra metadatos de llamadas. No realiza llamadas ni graba el audio: el archivo permanece en el almacenamiento de tu proveedor. Protege el acceso a la URL y aplica la normativa de grabación y retención correspondiente.

## Respuesta de éxito

Cuando crea un mensaje devuelve HTTP \`201\` y \`status: "created"\`. Para un mensaje ya registrado o un evento de entrega sin cambios devuelve HTTP \`200\` y \`status: "duplicate"\`. Una entrega que sí cambia de estado devuelve \`200\` y \`status: "status_updated"\`.

\`\`\`json
{
  "ok": true,
  "status": "created",
  "channelId": "uuid-del-canal",
  "identityId": "uuid-de-identidad-o-null",
  "personId": "uuid-de-persona-o-null",
  "caseId": "uuid-de-conversacion-o-null",
  "messageId": "uuid-del-mensaje",
  "reviewRequired": false,
  "stableId": true
}
\`\`\`

Los IDs que no puedan asociarse de forma fiable pueden ser \`null\`. \`reviewRequired\` indica que hay que revisar el caso o la identidad; no se debe interpretar \`ok: true\` como autorización para contestar automáticamente.

## Errores

Las validaciones propias devuelven \`{ "ok": false, "error": { "code": "...", "message": "..." } }\`. Las respuestas \`413\`, \`422\` y \`502\` no indican que se pueda volver a procesar el evento con un ID distinto.

| HTTP | Códigos de error |
| --- | --- |
| 413 | \`PAYLOAD_TOO_LARGE\` |
| 404 | \`UNKNOWN_CHANNEL\`, \`UNKNOWN_MESSAGE\` |
| 409 | \`UNKNOWN_PERSON\`, \`IDENTITY_MISSING\`, \`CASE_CONFLICT\` |
| 422 | \`INVALID_BODY\`, \`MISSING_CHANNEL\`, \`INVALID_CHANNEL\`, \`INVALID_DIRECTION\`, \`INVALID_EVENT_TYPE\`, \`MISSING_MESSAGE_ID\`, \`MISSING_STATUS\`, \`INVALID_EMAIL\`, \`INVALID_DATE\`, \`INVALID_SENDER\`, \`INVALID_STATUS\`, \`INVALID_ID\`, \`FIELD_TOO_LONG\`, \`UNSUPPORTED_GROUP\` |
| 422 | \`INVALID_CONVERSATION\`, \`UNKNOWN_CONVERSATION_FIELD\`, \`INVALID_CONVERSATION_FIELD\`, \`CONFLICTING_CATEGORY\`, \`INVALID_CATEGORY\`, \`UNKNOWN_CATEGORY\`, \`INVALID_LANGUAGE\`, \`INVALID_RECORDING_URL\`, \`CONVERSATION_ON_DELIVERY_EVENT\` |
| 422 | \`CHANNEL_TYPE_MISMATCH\`, \`PROVIDER_MISMATCH\`, \`ACCOUNT_MISMATCH\`, \`MISSING_ACCOUNT\` |
| 502 | \`INGESTION_FAILED\` (error inesperado de procesamiento o del SDK/REST) |

Un mensaje de error \`INGESTION_FAILED\` no expone credenciales ni contenido privado. En reintentos tras \`502\`, reutiliza **el mismo ID estable**; el procesamiento no es una transacción única y puede haber creado una parte de los registros antes del fallo.

\`\`\`json
{
  "ok": false,
  "error": { "code": "UNKNOWN_CATEGORY", "message": "Category is not available in this workspace" }
}
\`\`\`

## Deduplificación, agrupación y actualizaciones

- Cada mensaje utiliza una clave derivada de tipo de canal, proveedor, cuenta e ID externo. Los índices únicos evitan duplicados habituales, incluso entre ejecuciones concurrentes.
- Una respuesta puede encontrar su conversación por \`caseId\` verificado o por \`replyToExternalId\`. Una \`issueKey\` permite reutilizar un asunto, y \`THREAD\` agrupa por \`threadId\`.
- El modo \`SESSION\` busca conversaciones abiertas recientes de la identidad dentro de la ventana \`continuationHours\`. \`HYBRID\` y \`MANUAL\` pueden exigir revisión cuando la asociación es ambigua. El clasificador semántico y las reglas de envío siguen fuera de la función de ingestión.
- Ante un mensaje duplicado, la app puede reparar el vínculo con Persona si obtiene evidencia suficiente, pero no vuelve a aplicar \`conversation\`.
- Una notificación \`message.status\` no crea conversaciones. Las entregas \`DELIVERED\` y \`FAILED\` se tratan como estados terminales; una notificación tardía no rebaja \`DELIVERED\` a \`SENT\`.
- El endpoint no impide por sí mismo recibir eventos cuando un Canal está \`PAUSED\` o \`DISABLED\`. El flujo externo debe respetar esa política para evitar envíos no autorizados.

## API REST autogenerada por Twenty

Los siguientes recursos se instalan en **cada workspace**. Son rutas REST de Twenty, con su propio sistema de permisos. No pertenecen al handler \`/omnichannel/v1/ingest\`.

| Recurso | Campos propios principales | Relaciones |
| --- | --- | --- |
| \`people\` | Datos estándar de Persona de Twenty | \`supportCases\`, \`supportExternalIdentities\` |
| \`supportChannels\` | \`code\`, \`channelType\`, \`provider\`, \`externalIdentifier\`, \`status\`, \`health\`, \`lastEventAt\`, \`lastHeartbeatAt\`, \`lastErrorAt\`, \`errorSummary\`, \`staleAfterMinutes\`, \`groupingMode\`, \`continuationHours\`, \`reopenHours\`, \`semanticClassification\`, \`minClassificationConfidence\`, \`ambiguousAction\`, \`autoCloseEnabled\`, \`autoCloseDays\` | \`supportCases\`, \`supportExternalIdentities\` |
| \`supportExternalIdentities\` | \`externalKey\`, \`provider\`, \`externalUserId\`, \`externalAccountId\`, \`displayName\`, \`verified\`, \`lastSeenAt\` | \`personId\`, \`channelInstanceId\`, casos y alias |
| \`supportIdentityAliases\` | \`externalKey\`, \`aliasValue\`, \`aliasType\`, \`evidence\`, \`lastSeenAt\` | \`externalIdentityId\` |
| \`supportCases\` | \`subject\`, \`externalKey\`, \`channel\`, \`status\`, \`resolution\`, \`automation\`, \`technicalStatus\`, \`tags\`, \`customTags\`, \`assignedTo\`, \`originEmail\`, \`originPhone\`, \`firstMessageAt\`, \`lastMessageAt\`, \`resolvedAt\`, \`lastAutomationAt\`, \`escalatedAt\`, \`responseCount\`, \`summary\`, \`comments\`, \`language\`, \`followUp\`, \`followUpAt\`, \`transcription\`, \`recording\`, \`n8nExecutionId\` | \`personId\`, \`channelInstanceId\`, \`externalIdentityId\`, \`categoryId\`, mensajes y evaluaciones |
| \`supportMessages\` | \`externalKey\`, \`direction\`, \`senderType\`, \`fromAddress\`, \`toAddress\`, \`subject\`, \`body\`, \`occurredAt\`, \`callTranscription\`, \`callRecording\`, \`deliveryStatus\`, \`provider\`, \`n8nExecutionId\`, \`replyDecision\`, \`draftBody\`, \`sentAt\`, \`deliveredAt\`, \`botConfidence\`, \`replyToExternalKey\`, \`providerChatId\`, \`providerChatIdAlt\`, \`providerAddressingMode\`, \`providerMessageId\` | \`supportCaseId\`, evaluaciones |
| \`supportCategories\` | \`name\` (base), \`code\`, \`enabled\`, \`description\` | casos y FAQs |
| \`supportFaqs\` | \`question\`, \`answer\`, \`variants\`, \`language\`, \`status\`, \`tags\`, \`customTags\`, \`sourceUrl\`, \`updatedByReference\`, \`revision\`, \`publishedAt\`, \`lastSyncedAt\` | \`categoryId\` |
| \`supportEvaluations\` | \`externalKey\`, \`targetScope\`, \`verdict\`, \`score\`, \`comment\`, \`proposedCorrection\`, \`reviewer\`, \`reviewedAt\`, \`followupStatus\`, \`linkedTaskId\` | \`supportCaseId\`, \`supportMessageId\`, \`taskId\` |
| \`supportSettings\` | \`key\`, \`valueType\`, \`valueText\`, \`valueNumber\`, \`valueBoolean\`, \`enabled\`, \`description\` | Sin relación de dominio obligatoria |

Los objetos personalizados también reciben los campos del sistema de Twenty, incluidos \`id\`, \`createdAt\` y \`updatedAt\`. Para revisar su esquema exacto y las operaciones disponibles, usa **Settings → Developers → API Playground** del workspace.

### Operaciones de registros

\`\`\`http
GET    /rest/supportCases?limit=20
GET    /rest/supportCases/{id}
PATCH  /rest/supportCases/{id}
GET    /rest/supportMessages?filter=supportCaseId[eq]:"UUID"
GET    /rest/supportChannels?filter=code[eq]:"email-soporte"
GET    /rest/supportCategories?filter=code[eq]:"PEDIDOS"
GET    /rest/supportSettings?filter=key[eq]:"omnichannel.dashboard.visibleKpis"
\`\`\`

El SDK utilizado por la app también trabaja con \`POST /rest/{recurso}\` para crear y \`PATCH /rest/{recurso}/{id}\` para actualizar. Las formas de respuesta, filtros, campos compuestos, paginación y permisos efectivos corresponden a la versión de Twenty instalada; el Playground es la referencia definitiva de esa instancia.

En el editor nativo de Twenty, el objeto \`supportCases\` aparece como **Conversaciones**. Este cambio de etiqueta no modifica rutas REST ni nombres técnicos. El menú lateral está agrupado bajo **Omnichannel**.

### Selectores y valores frecuentes

| Campo | Opciones |
| --- | --- |
| \`supportCases.resolution\` | \`PENDING\`, \`SOLVED\`, \`UNSOLVED\`, \`NOT_APPLICABLE\` |
| \`supportCases.automation\` | \`PENDING\`, \`FULL\`, \`PARTIAL\`, \`NONE\` |
| \`supportCases.technicalStatus\` | \`UNKNOWN\`, \`PENDING\`, \`SUCCESS\`, \`RETRYING\`, \`ERROR\` |
| \`supportCases.tags\` | \`URGENT\`, \`REPEAT\`, \`VIP\`, \`ESCALATED\`, \`FOLLOWUP\` |
| \`supportChannels.status\` | \`ACTIVE\`, \`PAUSED\`, \`DISABLED\` |
| \`supportChannels.health\` | \`UNKNOWN\`, \`HEALTHY\`, \`WARNING\`, \`CRITICAL\` |
| \`supportChannels.groupingMode\` | \`THREAD\`, \`MESSAGE\`, \`HYBRID\`, \`SESSION\`, \`MANUAL\` |
| \`supportChannels.ambiguousAction\` | \`REVIEW\`, \`NEW\` |
| \`supportIdentityAliases.aliasType\` | \`WHATSAPP_PN\`, \`WHATSAPP_LID\`, \`PROVIDER_ID\` |
| \`supportMessages.replyDecision\` | \`REPLY\`, \`SKIP\`, \`ESCALATE\`, \`PENDING_REVIEW\` |
| \`supportFaqs.status\` | \`DRAFT\`, \`PUBLISHED\`, \`ARCHIVED\` |
| \`supportFaqs.language\` | \`ES\`, \`CA\`, \`EN\` |
| \`supportEvaluations.targetScope\` | \`CASE\`, \`MESSAGE\` |
| \`supportEvaluations.verdict\` | \`PENDING\`, \`CORRECT\`, \`INCORRECT\`, \`PARTIAL\` |
| \`supportEvaluations.followupStatus\` | \`NOT_REQUIRED\`, \`PENDING\`, \`IN_PROGRESS\`, \`DONE\` |
| \`supportSettings.valueType\` | \`TEXT\`, \`NUMBER\`, \`BOOLEAN\` |

Las Categorías son registros gestionados por workspace; \`categoryCode\` de la ingestión es un código de registro, no una opción \`SELECT\`. Las opciones añadidas por un workspace pueden diferir de las opciones declaradas por defecto en el paquete.

## Indicadores y configuración del resumen

La página Omnichannel → Resumen lee \`totalCount\` de peticiones REST independientes a \`supportCases\` y \`supportEvaluations\`. Los contadores incluidos son: conversaciones registradas, \`status=HUMAN_REQUIRED\`, \`technicalStatus=ERROR\` y evaluaciones \`verdict=INCORRECT\`.

La selección de indicadores visibles se guarda en \`supportSettings\` bajo \`omnichannel.dashboard.visibleKpis\`, con \`valueType=TEXT\` y \`valueText\` como array JSON de \`total\`, \`pendingHuman\`, \`technicalError\` e \`incorrect\`. Las gráficas, tendencias y periodos se configuran en dashboards nativos de Twenty por workspace.

## Integración con n8n y seguridad

Usa un único nodo **HTTP Request** después de validar el origen del evento, normalizar el payload y seleccionar la credencial del workspace. La lógica del endpoint evita repetir en n8n las operaciones individuales de búsqueda y creación de Persona, identidad, conversación y mensaje.

Comprueba los permisos del token y aplica deduplicación con IDs estables. Antes de enviar respuestas, el workflow debe consultar las reglas del Canal y del proveedor. El endpoint guarda información recibida; no envía ni cancela mensajes.

Evita guardar enlaces públicos permanentes de grabaciones o tokens dentro de una URL. El validador exige HTTPS y prohíbe credenciales embebidas, pero no comprueba permisos de acceso, caducidad de enlaces ni la política de conservación del audio.

## Código y documentación relacionada

- [Contrato y validación](../src/lib/ingestion/contract.ts)
- [Agrupación y persistencia](../src/lib/ingestion/processor.ts)
- [Handler HTTP](../src/logic-functions/omnichannel-ingest.logic-function.ts)
- [Guía de integración](INGESTION_API.md)
- [Integración n8n](INTEGRACION_N8N.md)
- [Arquitectura](ARQUITECTURA.md)
- [Publicación](PUBLICACION.md)
