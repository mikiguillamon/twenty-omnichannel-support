# Referencia de API: Omnichannel Support

Contrato de integración de Omnichannel Support para Twenty CRM 2.50. Los ejemplos usan datos ficticios.

El servicio de ingestión recibe eventos normalizados de proveedores de correo, mensajería y telefonía. Los adaptadores de n8n, Make o un servicio propio preparan esos eventos, mientras Twenty guarda la conversación y los mensajes. La API de registros de Twenty sigue disponible para consultar y editar las entidades.

## Propuestas de respuesta por correo

- En `POST /s/omnichannel/v1/ingest`, añade `proposedReply: { "body": "…", "callbackUrl": "…" }` a un correo entrante con ID estable. Envía `X-Omnichannel-Proposal-Key` con el secreto de propuestas del workspace. El cuerpo admite hasta 50.000 caracteres. El destino debe ser una URL HTTPS de Wait bajo la base configurada del workspace. El resultado añade `proposalMessageId` y `proposalStatus`. El caso comienza en `IN_PROGRESS` por defecto, sujeto a las reglas de revisión de identidad. Si el mismo correo pendiente se registra con otra URL de Wait, la ruta devuelve `409`.
- `POST /s/omnichannel/v1/proposals/decide` recibe `messageId`, `confirmed` y `message` al confirmar. El descarte requiere `confirmed: false` y omite `message`. La ruta exige un usuario de Twenty con acceso de escritura al mensaje.
- La llamada de Twenty a Wait incluye `confirmed`, `proposalMessageId`, `caseId` y, si hay confirmación, `message`. La cabecera `Idempotency-Key` contiene el ID de la propuesta. Una decisión aceptada devuelve `proposalStatus: "CONFIRMED"` o `"DISCARDED"`. El envío real se registra con un evento posterior del proveedor.

Consulta la [configuración del workflow de n8n](INTEGRACION_N8N.md#revisar-una-respuesta-de-correo-en-twenty).

## Búsqueda inteligente de FAQs (beta.21)

La API de búsqueda reutiliza **únicamente el token Bearer del workspace de Twenty**. El alcance es un filtro solicitado en cada petición, no un sistema de permisos separado ni un registro de bots.

```http
POST /s/omnichannel/v1/faqs/search
Authorization: Bearer TWENTY_WORKSPACE_TOKEN
Content-Type: application/json

{
  "query": "¿Cómo puedo darme de baja del abono?",
  "scopeTags": ["VERANO"],
  "language": "auto",
  "limit": 5
}
```

**Parámetros:** `query` (obligatoria, 1–320 caracteres); `scopeTags` (opcional, array de hasta 12 nombres, normalizado a códigos como `VERANO`); `language` (`auto`, `ES`, `CA`, `EN`, por defecto `auto`); `limit` (1–10, por defecto 5).

La búsqueda añade siempre el alcance `GENERAL`, aunque no aparezca en `scopeTags`. Si el campo está omitido o vacío, **solo** busca en `GENERAL`. Una FAQ sin alcance nunca se devuelve. Las FAQs con estado `DRAFT` o `ARCHIVED` se excluyen siempre. No se aceptan expresiones REST, filtros arbitrarios ni campos adicionales enviados por el cliente.

El servidor construye un filtro REST de origen con `status=PUBLISHED` y condiciones `ilike` sobre pregunta, variantes y respuesta. **No incluye `scopeTags` en el filtro REST** porque el parser REST real de Twenty 2.50 rechaza tanto `containsAny` como `containsIlike` para ese campo `ARRAY`. Omnichannel filtra las candidatas por alcance **después de recuperarlas y antes de puntuarlas o devolverlas**, normalizando valores heredados como `General` y `Campus Hivern`. Los candidatos están limitados y una búsqueda demasiado amplia falla de forma explícita: nunca se devuelven FAQs fuera de alcance. El filtrado por alcance sigue siendo una restricción de recuperación, no una autorización entre clientes.

Se limita el ranking a **200 candidatas** como máximo, en páginas de 50. Si hay más coincidencias devuelve `SEARCH_TOO_BROAD` (`422`) en lugar de un resultado parcial potencialmente engañoso. Una búsqueda válida sin coincidencias devuelve `ok: true` con `results: []`.

```json
{
  "ok": true,
  "query": "¿Cómo puedo darme de baja del abono?",
  "results": [
    {
      "id": "fa4d0011-9988-4a51-af11-d9e439140f03",
      "question": "Com puc donar-me de baixa de l'abonament?",
      "answer": "Per tramitar la baixa...",
      "language": "CA",
      "score": 103,
      "matchedFields": ["question", "variants"]
    }
  ],
  "count": 1
}
```

La búsqueda lee FAQs publicadas con el rol de Omnichannel Support. Cualquier cliente autenticado que pueda invocar la ruta puede seleccionar otros alcances. Para aislar contenido confidencial entre integraciones, utiliza workspaces separados. Los logs de la app omiten cuerpos de consulta y tokens. [Seguridad y privacidad](SEGURIDAD.md).

Los errores de validación incluyen `INVALID_REQUEST`, `INVALID_QUERY`, `INVALID_SCOPE`, `INVALID_LANGUAGE`, `INVALID_LIMIT`; exceso de cuerpo `PAYLOAD_TOO_LARGE` (`413`); demasiadas candidatas `SEARCH_TOO_BROAD` (`422`), y errores de almacenamiento (`502`) clasificados como `FAQ_REST_BAD_REQUEST`, `FAQ_REST_ACCESS_DENIED`, `FAQ_REST_RATE_LIMIT`, `FAQ_REST_UPSTREAM_ERROR`, `FAQ_REST_CLIENT_FAILURE` o `FAQ_SEARCH_UNAVAILABLE`, sin divulgar contenido ni credenciales. Twenty puede devolver `401`/`403` antes de llamar al endpoint.

**Compatibilidad Twenty 2.50 comprobada en EGORA:** el parser REST rechaza `containsAny` y `containsIlike` sobre `scopeTags`. Solo se filtran en REST el estado y las coincidencias textuales; la aplicación comprueba los alcances sobre el conjunto acotado, antes de devolver resultados. Las pruebas reales con la API de EGORA confirmaron HTTP 200 para `status[eq]`, `question[ilike]` y filtros combinados `and`/`or`. Tras actualizar el paquete, debe verificarse el endpoint de búsqueda completo.

## Requisitos y autenticación

- Instala la app en el workspace de destino. La compatibilidad declarada del paquete es Twenty `>=2.50.0 <2.51.0` y Node `^24.5.0`.
- Crea un Canal en ese workspace con un `code` único, `channelType` y, cuando corresponda, `provider` y `externalIdentifier`.
- Usa una credencial Bearer del workspace y guárdala en el gestor de credenciales de tu integración. Las escrituras de ingestión se ejecutan con el rol de Omnichannel Support. [Seguridad y privacidad](SEGURIDAD.md).
- La función se registra como ruta HTTP autenticada con `POST`, `isAuthRequired: true` y `timeoutSeconds: 30`. La ruta configurada en la app es `/omnichannel/v1/ingest`; la URL externa documentada para Twenty 2.50 suele ser:

```http
POST https://TWENTY_HOST/s/omnichannel/v1/ingest
Authorization: Bearer WORKSPACE_API_TOKEN
Content-Type: application/json
```

Confirma la URL real de la función y su resolución de workspace en la instalación antes de poner en marcha un flujo. La autenticación y autorización pueden devolver `401` o `403` desde Twenty antes de ejecutar el handler.

El handler rechaza cuerpos `rawBody` de más de **256.000 bytes** con `413 PAYLOAD_TOO_LARGE`. Sus respuestas incluyen `Cache-Control: no-store`. El límite de ejecución es de 30 segundos.

## POST /omnichannel/v1/ingest

La petición acepta un objeto JSON. Puedes enviar datos modernos dentro de `contact`, `message` y `conversation`; se conservan ciertos campos planos por compatibilidad con integraciones anteriores.

### Campos de nivel superior

| Campo | Tipo | Cómo se utiliza |
| --- | --- | --- |
| `channelCode` | string, obligatorio | Código del Canal, convertido a minúsculas, máximo 120 caracteres. Debe existir en el workspace. |
| `channelType` | enum, opcional | `EMAIL`, `WHATSAPP`, `INSTAGRAM`, `TELEGRAM`, `PHONE`. Si se envía, debe coincidir con el Canal. |
| `provider` | string, opcional | Identificador del proveedor, convertido a minúsculas, máximo 120 caracteres. Si el Canal declara uno, debe coincidir. |
| `accountId` | string, opcional | ID de cuenta, buzón o línea, convertido a minúsculas, máximo 300 caracteres. También admite `account`. Si se omite, se utiliza `channel.externalIdentifier`. |
| `eventType` | enum, opcional | `message.received`, `message.sent`, `message.status`. Se infiere como recibido o enviado a partir de la dirección cuando se omite. |
| `contact` | object, opcional | Identidad del interlocutor y vínculo opcional con Persona. |
| `message` | object, opcional | Mensaje nuevo o notificación de entrega. Hay campos planos equivalentes para compatibilidad. |
| `conversation` | object, opcional | Cambios a aplicar a la conversación al registrar un mensaje nuevo. No es un endpoint de edición independiente. |

El ámbito de las claves externas se deriva de `channelType:provider:accountId`. Una misma ID de proveedor puede utilizarse en cuentas distintas sin colisionar.

### Contacto (`contact`)

| Campo | Tipo | Regla |
| --- | --- | --- |
| `externalId` o `externalUserId` | string | ID estable del usuario en el proveedor. También se admite `externalUserId` en la raíz. Se normaliza a minúsculas, máximo 300 caracteres. |
| `email` | string | Dirección de correo validada; se normaliza a minúsculas. Alternativa plana: `customerEmail`. Para email puede derivarse del remitente o destinatario según la dirección. |
| `phone` | string | Número de origen, máximo 80 caracteres; alternativa `originPhone` en raíz. El endpoint no valida E.164 ni fusiona Personas por teléfono. |
| `name` | string | Nombre visible, máximo 500 caracteres; alternativa `displayName` en raíz. No se divide automáticamente en nombre y apellidos. |\n| `firstName` | string | Nombre de pila explícito, máximo 255 caracteres. Alternativa plana: `firstName`. |\n| `lastName` | string | Apellidos explícitos, máximo 255 caracteres. Alternativa plana: `lastName`. Se guardan en `people.name.lastName` cuando la Persona se puede identificar de forma segura. |
| `personId` | string | UUID de Persona de Twenty. Solo se usa para vinculación directa cuando `verified: true`. |
| `verified` | boolean | Señal explícita de comprobación del interlocutor; `true` habilita la búsqueda o vinculación segura de Persona para canales que no son email. |
| `remoteJid`, `remoteJidAlt` | string | Direcciones de WhatsApp PN y LID. También se admiten en `message` y en raíz; se convierten en alias de identidad cuando son válidas. |

Para `EMAIL`, la app puede encontrar o crear una Persona por correo electrónico. En los demás canales necesita `verified: true` y evidencia suficiente. Una identidad externa puede existir sin Persona. Ante coincidencias múltiples o alias incompatibles, la vinculación pasa a revisión.

### Mensaje (`message`)

| Campo | Tipo | Regla y alternativa |
| --- | --- | --- |
| `externalId` | string | ID del evento/mensaje del proveedor, máximo 300 caracteres. También `messageId`, `providerMessageId` o sus alternativas planas. |
| `idempotencyKey` | string | Clave estable alternativa si no hay ID del proveedor, máximo 300 caracteres. También se admite en raíz. |
| `direction` | enum | `INBOUND` o `OUTBOUND`. Por defecto `INBOUND`, excepto `message.sent`. |
| `senderType` | enum | `CUSTOMER`, `BOT`, `AGENT`. Predeterminado: cliente en entrada, agente en salida. |
| `deliveryStatus` | enum | `RECEIVED`, `PENDING`, `SENT`, `DELIVERED`, `FAILED`. Predeterminado: `RECEIVED` en entradas y `PENDING` en salidas, salvo `message.sent` que presume `SENT` si se omite. |
| `body` o `text` | string | Texto, máximo 100.000 caracteres. Si está vacío, el registro usa el marcador `[Message without text or with attachment]`. Alternativa `body` en raíz. |
| `subject` | string | Asunto, máximo 500 caracteres. Valor predeterminado: `Support enquiry`. Alternativa en raíz. |
| `fromAddress` o `from` | string | Origen, máximo 500 caracteres. Alternativa `fromAddress` en raíz. |
| `toAddress` o `to` | string | Destino, máximo 500 caracteres. Alternativa `toAddress` en raíz. |
| `occurredAt` | ISO 8601 | Fecha real del evento. Si se omite, se utiliza la hora de procesamiento. Alternativa plana. |
| `threadId` | string | Hilo del proveedor, máximo 350 caracteres. Alternativa plana. Es especialmente útil para `THREAD`. |
| `issueKey` | string | Referencia del asunto, máximo 350 caracteres. Alternativa plana; reutilízala al continuar una conversación. |
| `caseId` | string | ID de `supportCase` existente. Alternativa plana. El servidor verifica que sea coherente con Canal e identidad. |
| `replyToExternalId` | string | ID del mensaje del proveedor al que se responde, máximo 300 caracteres; alternativa `replyToMessageId` en raíz. |
| `providerChatId` | string | Dirección de chat original, máximo 300 caracteres; alternativa `remoteJid` en raíz. |
| `providerChatIdAlt` | string | Dirección alternativa, máximo 300 caracteres; alternativa `remoteJidAlt` en raíz. |
| `providerAddressingMode` | string | Contexto de direccionamiento del proveedor, máximo 80 caracteres. Alternativa plana. |
| `remoteJid`, `remoteJidAlt` | string | También se utilizan para descubrir alias WhatsApp, como en `contact`. |
| `callTranscription` | string o null | Transcripción del mensaje o llamada, máximo 100.000 caracteres. Se guarda en `supportMessages.callTranscription` si contiene texto. |
| `callRecordingUrl` | string o null | URL HTTPS de audio, máximo 2.048 caracteres, sin usuario/contraseña en la URL. Se guarda como `LINKS` en `supportMessages.callRecording`. |

Si no envías `externalId` ni `idempotencyKey`, el servidor genera una clave distinta para esa petición y responde `stableId: false`. **Los reintentos no quedan deduplicados** en ese caso. En producción conviene aportar siempre un ID estable por mensaje.

### Conversación (`conversation`)

Los siguientes campos pueden enviarse tanto con el primer mensaje como con uno nuevo que se incorpore a la conversación. Un campo omitido conserva el valor actual. Los campos con `null` admitido se pueden limpiar expresamente.

| Campo | Tipo | Comportamiento |
| --- | --- | --- |
| `subject` | string o null | Título de la conversación, máximo 500 caracteres. `null` limpia el asunto; si no se indica, se conserva el título inicial. |
| `typeId` | UUID o null | Tipo de conversación existente en el workspace; usa la relación `caseTypeId`. |
| `typeCode` | string o null | Código exacto del tipo. Si no existe, se crea automáticamente con `code` y `name` iguales; usa `typeId` o `typeCode`, nunca ambos. |
| `tags` | string[] | Sustituye las etiquetas estándar de la conversación. Valores: `URGENT`, `REPEAT`, `VIP`, `ESCALATED`, `FOLLOWUP`. `[]` las limpia. |
| `customTags` | string[] | Etiquetas de texto libres (máximo 30, 64 caracteres cada una), independientes de `tags`. `[]` las limpia. |
| `resolution` | enum | `PENDING`, `SOLVED`, `UNSOLVED`, `NOT_APPLICABLE`. |
| `automation` | enum | `PENDING`, `FULL`, `PARTIAL`, `NONE`. |
| `technicalStatus` | enum | `UNKNOWN`, `PENDING`, `SUCCESS`, `RETRYING`, `ERROR`. |
| `assignedTo` | string o null | Texto de responsable, máximo 255 caracteres. |
| `status` | enum | `NEW`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `HUMAN_REQUIRED`, `RESOLVED`, `CLOSED`, `AUTOMATED`, `INFORMATIONAL`, `WAITING_INTERNAL`. |
| `followUp` | enum o null | `NONE`, `REQUIRED`, `SCHEDULED`, `WAITING_RESPONSE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. |
| `followUpAt` | ISO 8601 o null | Fecha y hora del seguimiento; exige zona horaria `Z` u offset y se normaliza a UTC. |
| `categoryId` | UUID o null | Categoría ya creada en el workspace. |
| `categoryCode` | string o null | Código exacto de categoría. Si no existe, se crea automáticamente con `code` y `name` iguales. No envíes `categoryId` y `categoryCode` juntos. |
| `summary` | string o null | Resumen libre, máximo 100.000 caracteres. |
| `comments` | string o null | Comentarios operativos, máximo 100.000 caracteres. |
| `language` | string o null | Etiqueta de idioma, por ejemplo `es`, `ca`, `en` o `es-ES`. Máximo 48 caracteres, validación sintáctica tipo BCP 47. |
| `transcription` | string o null | Transcripción a nivel conversación, máximo 100.000 caracteres. |
| `recordingUrl` | string o null | Enlace HTTPS a la grabación, máximo 2.048 caracteres. Se transforma al campo `LINKS` `supportCases.recording`. |

El tipo y la categoría se gestionan como registros independientes del workspace: `supportTypes` y `supportCategories`. Ambos tienen un `code` único y un `name` (campo base de Twenty). Al enviar un **código nuevo** válido, la app crea el registro automáticamente con `name = code` y `enabled = true` y lo vincula a la conversación. Un código ya existente se reutiliza sin cambiar su nombre, descripción ni configuración. Si dos mensajes intentan crearlo a la vez, el índice único evita duplicados.

Los códigos distinguen mayúsculas y minúsculas y admiten letras ASCII, números, guion y guion bajo, hasta 120 caracteres. Los valores `null` borran el vínculo; un UUID enviado con `categoryId` o `typeId` **nunca** crea registros. Una categoría o tipo ya desactivado (`enabled: false`) no se reactiva automáticamente y se rechaza como no disponible. Las etiquetas predefinidas (`tags`) y libres (`customTags`) son dos campos diferentes. Si se detecta ambigüedad de identidad o agrupación y se crea una conversación nueva para revisión, la app fuerza `HUMAN_REQUIRED`, incluso si el evento solicitaba otro estado.

Los estados de la conversación son distintos de `deliveryStatus` (envío del mensaje), `resolution` (resultado del caso) y `technicalStatus` (funcionamiento del bot). El bloque `conversation` no admite claves arbitrarias ni valores anidados adicionales.

Una petición `message.status` no admite un bloque `conversation` con cambios. Para editar solo la conversación, usa la API REST estándar de Twenty, con los permisos correspondientes: `PATCH /rest/supportCases/{id}`.

### FAQs por alcance y acceso desde bots

Cada FAQ tiene ahora `scopeTags: string[]`, independiente de `category`, `tags` y `status`. Se administra en el editor de la ficha FAQ y también a través de la API REST generada por Twenty:

```http
PATCH /rest/supportFaqs/{faqId}
Authorization: Bearer TOKEN_DEL_WORKSPACE
Content-Type: application/json

{"scopeTags":["GENERAL","VERANO"]}
```

El editor normaliza los nombres introducidos a códigos estables en mayúsculas sin acentos (por ejemplo, `Campaña 2027` pasa a `CAMPANA_2027`). Las llamadas REST directas deben utilizar esos mismos códigos.

Para un bot con alcance `VERANO`, pide solo FAQs publicadas con al menos uno de `GENERAL` o `VERANO`. Ejemplo de filtro REST de Twenty:

```http
GET /rest/supportFaqs?filter=and(status[eq]:"PUBLISHED",question[ilike]:"%quota%")
Authorization: Bearer TOKEN_DEL_WORKSPACE
```

Codifica el parámetro `filter` con URL encoding en tu cliente HTTP. `GENERAL` es un alcance compartido, no un valor implícito: solo se devuelve si está presente explícitamente en `scopeTags`. Una FAQ sin etiquetas de alcance queda fuera de las consultas filtradas. Añadir etiquetas no publica una FAQ en borrador.

**Seguridad:** el filtrado de alcance en n8n no sustituye el control de permisos de Twenty. Usa credenciales por workspace y restringe el acceso de cada bot a su base de conocimiento. Los bots deben consultar el filtro apropiado y no descargar la colección completa.

### Metadatos de conversaciones existentes

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "contact": {"email": "cliente@example.com"},
  "message": {"externalId": "msg-002", "threadId": "thread-120", "body": "Quiero cambiar mi reserva."},
  "conversation": {
    "subject": "Cambio de reserva",
    "typeCode": "CONSULTA",
    "categoryCode": "RESERVAS",
    "tags": ["VIP"],
    "customTags": ["verano-2027"],
    "status": "IN_PROGRESS",
    "followUp": "REQUIRED",
    "summary": "Solicita modificar su reserva"
  }
}
```

Si `CONSULTA` o `RESERVAS` no existen en ese workspace, el primer mensaje los crea automáticamente con el mismo código y nombre. Los cambios del bloque `conversation` se aplican al crear el mensaje nuevo en la conversación existente; no hace falta un PATCH REST adicional desde n8n. Los campos omitidos mantienen sus valores. El reintento de un mensaje con la misma clave idempotente no vuelve a sobrescribir sus metadatos.

## Ejemplos completos

### Crear una conversación de email

```json
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
```

Para añadir una respuesta al mismo hilo, mantén `threadId: "thread-120"` y usa otro `message.externalId`:

```json
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
```

En un Canal `THREAD`, el segundo mensaje puede compartir conversación con el primero si supera las comprobaciones de titularidad. El estado cambia al procesar el mensaje **nuevo**. Reenviar `msg-002` devuelve `duplicate` y no vuelve a sobrescribir el estado.

### Agrupación automática de chats por canal

Con `groupingMode=HYBRID` o `SESSION`, la API busca automáticamente una única conversación reciente y compatible del interlocutor en el mismo canal. Para ello usa la identidad externa (PN JID/LID en WhatsApp), la Persona verificada y, cuando procede, correo **verificado junto al mismo teléfono** para recuperar conversaciones antiguas sin vínculo. No mezcla conversaciones de identidades incompatibles.

La búsqueda aplica `continuationHours` (72 horas por defecto) a conversaciones abiertas, incluidas `AUTOMATED` e `INFORMATIONAL`. Las `RESOLVED` pueden reabrirse durante `reopenHours` (48 horas por defecto) cuando el nuevo mensaje solicita un estado activo; `CLOSED` requiere una referencia explícita. Si hay varias conversaciones candidatas, se sigue `ambiguousAction` (`REVIEW` o `NEW`) sin elegir arbitrariamente.

La API respeta `message.caseId`, `replyToExternalId`, `issueKey` y `threadId` cuando existen, validando propiedad. Una clave sintética `issueKey` con prefijo `standalone-auto:` no bloquea la agrupación automática si hay una conversación elegible. Los reintentos duplicados y eventos `message.status` no aplican cambios de estado general.

Si el mensaje de WhatsApp sale de un workflow que solo conoce `contact.phone` en E.164 (por ejemplo `+34600111222`), la API puede usar el PN JID correspondiente como identidad de contacto, incluso si no se envía `channelType`. El `accountId` identifica siempre la cuenta emisora de la integración, no el teléfono ni email del cliente.

### Confirmar la entrega de un mensaje

```json
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
```

El evento busca un mensaje existente y actualiza su entrega sin crear otro. No envíes `conversation` en esta operación.

### WhatsApp con PN y LID

```json
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
```

Los JID y LID se guardan como alias observados de una identidad externa. Los grupos de WhatsApp `@g.us` están excluidos de este endpoint. No se vincula una Persona por teléfono sin evidencia verificada.

### Llamada telefónica

```json
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
```

La app registra metadatos de llamadas y reproduce las grabaciones HTTPS desde la pestaña Conversación, usando el reproductor de audio del navegador. También añade automáticamente la transcripción y la URL al caso telefónico si el evento no aporta un valor explícito para ellos. No realiza llamadas ni graba o sube el audio: el archivo permanece en el almacenamiento de tu proveedor. El endpoint de ingesta sigue siendo JSON, no multipart. La reproducción requiere un enlace accesible para el navegador autenticado (y un formato de audio compatible), por lo que no deben enviarse credenciales incrustadas, enlaces públicos permanentes ni URLs internas. Las URLs firmadas con caducidad pueden dejar de funcionar después. Protege el acceso y aplica las políticas de consentimiento y retención que correspondan.

## Respuesta de éxito

Cuando crea un mensaje devuelve HTTP `201` y `status: "created"`. Para un mensaje ya registrado o un evento de entrega sin cambios devuelve HTTP `200` y `status: "duplicate"`. Una entrega que sí cambia de estado devuelve `200` y `status: "status_updated"`.

```json
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
```

Los IDs que no puedan asociarse de forma fiable pueden ser `null`. `reviewRequired` indica que hay que revisar el caso o la identidad; no se debe interpretar `ok: true` como autorización para contestar automáticamente.

## Errores

Las validaciones propias devuelven `{ "ok": false, "error": { "code": "...", "message": "..." } }`. Las respuestas `413`, `422` y `502` no indican que se pueda volver a procesar el evento con un ID distinto.

| HTTP | Códigos de error |
| --- | --- |
| 413 | `PAYLOAD_TOO_LARGE` |
| 404 | `UNKNOWN_CHANNEL`, `UNKNOWN_MESSAGE` |
| 409 | `UNKNOWN_PERSON`, `IDENTITY_MISSING`, `CASE_CONFLICT` |
| 422 | `INVALID_BODY`, `MISSING_CHANNEL`, `INVALID_CHANNEL`, `INVALID_DIRECTION`, `INVALID_EVENT_TYPE`, `MISSING_MESSAGE_ID`, `MISSING_STATUS`, `INVALID_EMAIL`, `INVALID_DATE`, `INVALID_SENDER`, `INVALID_STATUS`, `INVALID_ID`, `FIELD_TOO_LONG`, `UNSUPPORTED_GROUP` |
| 422 | `INVALID_CONVERSATION`, `UNKNOWN_CONVERSATION_FIELD`, `INVALID_CONVERSATION_FIELD`, `CONFLICTING_CATEGORY`, `INVALID_CATEGORY`, `UNKNOWN_CATEGORY`, `INVALID_LANGUAGE`, `INVALID_RECORDING_URL`, `CONVERSATION_ON_DELIVERY_EVENT` |
| 422 | `CHANNEL_TYPE_MISMATCH`, `PROVIDER_MISMATCH`, `ACCOUNT_MISMATCH`, `MISSING_ACCOUNT` |
| 502 | `INGESTION_FAILED` (error inesperado de procesamiento o del SDK/REST) |

Un mensaje de error `INGESTION_FAILED` no expone credenciales ni contenido privado. En reintentos tras `502`, reutiliza **el mismo ID estable**; el procesamiento no es una transacción única y puede haber creado una parte de los registros antes del fallo.

```json
{
  "ok": false,
  "error": { "code": "UNKNOWN_CATEGORY", "message": "Category is not available in this workspace" }
}
```

## Deduplificación, agrupación y actualizaciones

- Cada mensaje utiliza una clave derivada de tipo de canal, proveedor, cuenta e ID externo. Los índices únicos evitan duplicados habituales, incluso entre ejecuciones concurrentes.
- Una respuesta puede encontrar su conversación por `caseId` verificado o por `replyToExternalId`. Una `issueKey` permite reutilizar un asunto, y `THREAD` agrupa por `threadId`.
- El modo `SESSION` busca conversaciones abiertas recientes de la identidad dentro de la ventana `continuationHours`. `HYBRID` y `MANUAL` pueden exigir revisión cuando la asociación es ambigua. El clasificador semántico y las reglas de envío siguen fuera de la función de ingestión.
- Ante un mensaje duplicado, la app puede reparar el vínculo con Persona si obtiene evidencia suficiente, pero no vuelve a aplicar `conversation`.
- Una notificación `message.status` no crea conversaciones. Las entregas `DELIVERED` y `FAILED` se tratan como estados terminales; una notificación tardía no rebaja `DELIVERED` a `SENT`.
- El endpoint no impide por sí mismo recibir eventos cuando un Canal está `PAUSED` o `DISABLED`. El flujo externo debe respetar esa política para evitar envíos no autorizados.

## API REST autogenerada por Twenty

Los siguientes recursos se instalan en **cada workspace**. Son rutas REST de Twenty, con su propio sistema de permisos. No pertenecen al handler `/omnichannel/v1/ingest`.

| Recurso | Campos propios principales | Relaciones |
| --- | --- | --- |
| `people` | Datos estándar de Persona de Twenty | `supportCases`, `supportExternalIdentities` |
| `supportChannels` | `code`, `channelType`, `provider`, `externalIdentifier`, `status`, `health`, `lastEventAt`, `lastHeartbeatAt`, `lastErrorAt`, `errorSummary`, `staleAfterMinutes`, `groupingMode`, `continuationHours`, `reopenHours`, `semanticClassification`, `minClassificationConfidence`, `ambiguousAction`, `autoCloseEnabled`, `autoCloseDays` | `supportCases`, `supportExternalIdentities` |
| `supportExternalIdentities` | `externalKey`, `provider`, `externalUserId`, `externalAccountId`, `displayName`, `verified`, `lastSeenAt` | `personId`, `channelInstanceId`, casos y alias |
| `supportIdentityAliases` | `externalKey`, `aliasValue`, `aliasType`, `evidence`, `lastSeenAt` | `externalIdentityId` |
| `supportCases` | `subject`, `externalKey`, `channel`, `status`, `resolution`, `automation`, `technicalStatus`, `tags`, `customTags`, `assignedTo`, `originEmail`, `originPhone`, `firstMessageAt`, `lastMessageAt`, `resolvedAt`, `lastAutomationAt`, `escalatedAt`, `responseCount`, `summary`, `comments`, `language`, `followUp`, `followUpAt`, `transcription`, `recording`, `n8nExecutionId` | `personId`, `channelInstanceId`, `externalIdentityId`, `categoryId`, mensajes y evaluaciones |
| `supportMessages` | `externalKey`, `direction`, `senderType`, `fromAddress`, `toAddress`, `subject`, `body`, `occurredAt`, `callTranscription`, `callRecording`, `deliveryStatus`, `provider`, `n8nExecutionId`, `replyDecision`, `draftBody`, `sentAt`, `deliveredAt`, `botConfidence`, `replyToExternalKey`, `providerChatId`, `providerChatIdAlt`, `providerAddressingMode`, `providerMessageId` | `supportCaseId`, evaluaciones |
| `supportCategories` | `name` (base), `code`, `enabled`, `description` | casos y FAQs |
| `supportFaqs` | `question`, `answer`, `variants`, `language`, `status`, `tags`, `customTags`, `sourceUrl`, `updatedByReference`, `revision`, `publishedAt`, `lastSyncedAt` | `categoryId` |
| `supportEvaluations` | `externalKey`, `targetScope`, `verdict`, `score`, `comment`, `proposedCorrection`, `reviewer`, `reviewedAt`, `followupStatus`, `linkedTaskId` | `supportCaseId`, `supportMessageId`, `taskId` |
| `supportSettings` | `key`, `valueType`, `valueText`, `valueNumber`, `valueBoolean`, `enabled`, `description` | Sin relación de dominio obligatoria |

Los objetos personalizados también reciben los campos del sistema de Twenty, incluidos `id`, `createdAt` y `updatedAt`. Para revisar su esquema exacto y las operaciones disponibles, usa **Settings → Developers → API Playground** del workspace.

### Operaciones de registros

```http
GET    /rest/supportCases?limit=20
GET    /rest/supportCases/{id}
PATCH  /rest/supportCases/{id}
GET    /rest/supportMessages?filter=supportCaseId[eq]:"UUID"
GET    /rest/supportChannels?filter=code[eq]:"email-soporte"
GET    /rest/supportCategories?filter=code[eq]:"PEDIDOS"
GET    /rest/supportSettings?filter=key[eq]:"omnichannel.dashboard.visibleKpis"
```

El SDK utilizado por la app también trabaja con `POST /rest/{recurso}` para crear y `PATCH /rest/{recurso}/{id}` para actualizar. Las formas de respuesta, filtros, campos compuestos, paginación y permisos efectivos corresponden a la versión de Twenty instalada; el Playground es la referencia definitiva de esa instancia.

En el editor nativo de Twenty, el objeto `supportCases` aparece como **Conversaciones**. Este cambio de etiqueta no modifica rutas REST ni nombres técnicos. El menú lateral está agrupado bajo **Omnichannel**.

### Selectores y valores frecuentes

| Campo | Opciones |
| --- | --- |
| `supportCases.resolution` | `PENDING`, `SOLVED`, `UNSOLVED`, `NOT_APPLICABLE` |
| `supportCases.automation` | `PENDING`, `FULL`, `PARTIAL`, `NONE` |
| `supportCases.technicalStatus` | `UNKNOWN`, `PENDING`, `SUCCESS`, `RETRYING`, `ERROR` |
| `supportCases.tags` | `URGENT`, `REPEAT`, `VIP`, `ESCALATED`, `FOLLOWUP` |
| `supportChannels.status` | `ACTIVE`, `PAUSED`, `DISABLED` |
| `supportChannels.health` | `UNKNOWN`, `HEALTHY`, `WARNING`, `CRITICAL` |
| `supportChannels.groupingMode` | `THREAD`, `MESSAGE`, `HYBRID`, `SESSION`, `MANUAL` |
| `supportChannels.ambiguousAction` | `REVIEW`, `NEW` |
| `supportIdentityAliases.aliasType` | `WHATSAPP_PN`, `WHATSAPP_LID`, `PROVIDER_ID` |
| `supportMessages.replyDecision` | `REPLY`, `SKIP`, `ESCALATE`, `PENDING_REVIEW` |
| `supportFaqs.status` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `supportFaqs.language` | `ES`, `CA`, `EN` |
| `supportEvaluations.targetScope` | `CASE`, `MESSAGE` |
| `supportEvaluations.verdict` | `PENDING`, `CORRECT`, `INCORRECT`, `PARTIAL` |
| `supportEvaluations.followupStatus` | `NOT_REQUIRED`, `PENDING`, `IN_PROGRESS`, `DONE` |
| `supportSettings.valueType` | `TEXT`, `NUMBER`, `BOOLEAN` |

Las Categorías son registros gestionados por workspace; `categoryCode` de la ingestión es un código de registro, no una opción `SELECT`. Las opciones añadidas por un workspace pueden diferir de las opciones declaradas por defecto en el paquete.

## Indicadores y configuración del resumen

La página Omnichannel → Resumen lee `totalCount` de peticiones REST independientes a `supportCases` y `supportEvaluations`. Los contadores incluidos son: conversaciones registradas, `status=HUMAN_REQUIRED`, `technicalStatus=ERROR` y evaluaciones `verdict=INCORRECT`.

La selección de indicadores visibles se guarda en `supportSettings` bajo `omnichannel.dashboard.visibleKpis`, con `valueType=TEXT` y `valueText` como array JSON de `total`, `pendingHuman`, `technicalError` e `incorrect`. Las gráficas, tendencias y periodos se configuran en dashboards nativos de Twenty por workspace.

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
