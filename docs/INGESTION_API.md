# API de ingestión de mensajes

Omnichannel Support incorpora un endpoint de ingestión en la propia aplicación de Twenty. n8n conserva la recepción, el envío y la adaptación de los eventos de cada proveedor; Twenty resuelve contactos, identidades, consultas y el historial.

## Requisitos

- Twenty **2.50.x**, con la aplicación instalada en el **workspace de destino**.
- Un Canal de soporte en ese workspace con `code` único, `channelType` y los valores de `provider` y `externalIdentifier` configurados.
- Un token de API de Twenty **del mismo workspace**, con acceso a la ruta autenticada. No pongas el token en el JSON del evento.
- Comprueba en Settings → Developers → API la documentación REST específica de tu workspace; los nombres de objetos personalizados dependen de su esquema.
- No cambies la integración de n8n en producción hasta verificar el endpoint en un workspace de prueba.

## Endpoint

```http
POST https://TU-DOMINIO-TWENTY/s/omnichannel/v1/ingest
Authorization: Bearer TOKEN_DEL_WORKSPACE
Content-Type: application/json
```

La ruta se registra con `defineLogicFunction` y `isAuthRequired: true`. La URL efectiva puede depender de la configuración del dominio de funciones y de cómo Twenty resuelva el workspace: confirma la URL instalada antes de activar n8n. No es un webhook anónimo de proveedor; Gmail, Evolution, Telegram y los demás proveedores llaman primero a n8n, que autentica y normaliza su evento.

## Solicitud mínima de email

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "accountId": "soporte@ejemplo.com",
  "provider": "gmail",
  "contact": {
    "email": "cliente@ejemplo.com",
    "name": "Alex"
  },
  "message": {
    "externalId": "id-unico-del-proveedor",
    "threadId": "hilo-123",
    "direction": "INBOUND",
    "subject": "Información",
    "body": "Hola, quiero saber más."
  }
}
```

`provider` y `accountId` pueden omitirse cuando el Canal ya tiene configurados esos datos; si se proporcionan, deben coincidir. `channelType` también puede omitirse si el Canal existe. Para email saliente, usa `direction: "OUTBOUND"` y un correo del destinatario en `contact.email` o en `message.toAddress`.

También se aceptan los campos planos utilizados anteriormente por n8n (`customerEmail`, `messageId`, `threadId`, `body`, etc.).

## WhatsApp: PN JID y LID

```json
{
  "channelCode": "whatsapp-soporte",
  "channelType": "WHATSAPP",
  "accountId": "mi-instancia",
  "provider": "evolution",
  "contact": {
    "externalUserId": "34600111222@s.whatsapp.net",
    "remoteJid": "123456789012345@lid",
    "remoteJidAlt": "34600111222@s.whatsapp.net"
  },
  "message": {
    "externalId": "wamid-123",
    "body": "Hola, necesito ayuda"
  }
}
```

La asociación de PN y LID se limita al proveedor, cuenta y workspace. Si los alias resuelven a dos identidades diferentes, la Consulta se marca para revisión humana. Un teléfono o identificador de WhatsApp **no** demuestra por sí solo qué Persona nativa debe utilizarse.

Los eventos de grupos de WhatsApp (`@g.us`) se rechazan. Instagram y Telegram se registran usando el identificador externo que proporcione su plataforma; no se crean contactos basándose únicamente en su nombre visible.

## Identificadores y reintentos

- `message.externalId`: ID real del mensaje en su proveedor. Recomendado.
- `idempotencyKey`: clave estable alternativa cuando no existe un ID de proveedor. Debe ser siempre la misma para los reintentos del mismo mensaje.
- Sin ninguno de los dos, el servidor genera un ID único por petición: **no se puede deduplicar entre reintentos**.
- `message.threadId` es opcional. Si no existe, se aplican las políticas de agrupación del Canal. Una ausencia de referencia fiable puede crear una Consulta para revisión en lugar de agrupar arbitrariamente mensajes.
- `message.caseId`, `message.issueKey` o `message.replyToExternalId` permiten una vinculación explícita, que se valida para evitar asociar un mensaje al cliente equivocado.

### Actualizar estado de entrega

```json
{
  "eventType": "message.status",
  "channelCode": "email-soporte",
  "provider": "gmail",
  "accountId": "soporte@ejemplo.com",
  "message": {
    "externalId": "id-unico-del-proveedor",
    "deliveryStatus": "DELIVERED"
  }
}
```

Se actualiza el Mensaje existente; no se crea uno nuevo. Si el ID no se encuentra, devuelve un error. Esto no envía mensajes a proveedores externos.

## Respuesta

En una creación, el endpoint responde `201` con `status: "created"`. Un mensaje ya registrado devuelve `200` con `status: "duplicate"`. También puede devolver `status: "status_updated"`.

```json
{
  "ok": true,
  "status": "created",
  "channelId": "UUID",
  "personId": "UUID",
  "identityId": "UUID",
  "caseId": "UUID",
  "messageId": "UUID",
  "reviewRequired": false,
  "stableId": true
}
```

Los campos de relaciones pueden ser `null` cuando aún no existe una asociación fiable. Los errores de validación tienen un campo `error.code`; fallos inesperados se comunican con `INGESTION_FAILED` sin exponer credenciales ni contenido del mensaje.

## Nodo n8n recomendado

1. Recibe el correo o mensaje en el nodo propio del proveedor.
2. Usa **Edit Fields** para establecer únicamente `channelCode`, datos básicos de contacto y mensaje.
3. Envía un único **HTTP Request** con método POST, cuerpo JSON y credencial Bearer de Twenty del workspace correspondiente.
4. Activa **Retry on Fail** solo si puedes reenviar el mismo `externalId` o `idempotencyKey`; interpreta `duplicate` como éxito.
5. Registra el resultado técnico en n8n y deriva `reviewRequired` al circuito de revisión, si lo utilizas.

No encadenes nodos de búsqueda/creación de Persona, identidad, Consulta y Mensaje en n8n: esa lógica pertenece al endpoint.

## Publicación y migración

1. Revisa y aprueba el PR en GitHub tras comprobar la CI.
2. Valida contra un workspace de prueba con una app instalada en Twenty 2.50: lectura REST, creación de Persona, relación con identidad y Consulta, reintentos y PN/LID.
3. Actualiza la versión del paquete **en un commit independiente**, siguiendo el proceso de publicación del repositorio. Crea un tag GitHub Release coincidente y márcalo como **prerelease** para una beta.
4. El workflow de publicación ya utiliza GitHub Actions y Trusted Publishing para npm. Verifica que terminó correctamente y revisa los dist-tags.
5. Actualiza la app desde el Marketplace en un workspace de prueba. No elimines los objetos ni desinstales la aplicación: los IDs universales de esquema permanecen estables.
6. En n8n, sustituye el subworkflow anterior por el HTTP Request **solo después de una prueba de escritura real**. No mantengas simultáneamente ambos escritores para los mismos eventos.
7. Para revertir, vuelve temporalmente al workflow anterior de n8n o a la versión anterior de la app, según compatibilidad; evita desinstalaciones o eliminación de registros.

## Limitaciones que deben verificarse antes de producción

Una llamada HTTP no equivale a una transacción única de base de datos. Las claves externas con índices únicos ayudan a recuperarse de reintentos, pero los fallos entre la creación de Persona, Consulta y Mensaje pueden dejar datos parciales. Un reintento con ID estable debe recuperar el estado anterior.

Los tests unitarios de este repositorio usan un almacén de memoria. **No sustituyen una prueba de integración sobre una instalación real de Twenty**, especialmente para comprobar filtros REST, representación de campos compuestos (`emails`, `name`), joins de relaciones y resolución del workspace de las funciones.


## Campos de conversación opcionales en cada mensaje

El endpoint admite `conversation` además de `message`. Se aplica al crear la conversación o al **añadir un mensaje nuevo a una conversación existente**. Si se omite un campo, mantiene su valor; `null` permite borrar ciertos campos. Los reintentos de un mensaje ya registrado no vuelven a escribir sus metadatos ni revierten estados más recientes. Los eventos `message.status` solo gestionan la entrega del mensaje y rechazan `conversation`.

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@ejemplo.com",
  "contact": { "email": "cliente@ejemplo.com" },
  "message": {
    "externalId": "msg-234",
    "threadId": "thread-100",
    "body": "Necesito información."
  },
  "conversation": {
    "status": "WAITING_INTERNAL",
    "followUp": "REQUIRED",
    "followUpAt": "2026-11-20T09:00:00Z",
    "categoryCode": "SOPORTE",
    "summary": "Información solicitada",
    "comments": "Contactar con responsable",
    "language": "es"
  }
}
```

| Campo | Valores admitidos |
|---|---|
| `status` | `NEW`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `HUMAN_REQUIRED`, `RESOLVED`, `CLOSED`, `AUTOMATED`, `INFORMATIONAL`, `WAITING_INTERNAL` |
| `followUp` | `NONE`, `REQUIRED`, `SCHEDULED`, `WAITING_RESPONSE`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` (también `null`) |
| `followUpAt` | Fecha/hora ISO 8601 o `null` |
| `categoryId` o `categoryCode` | UUID o código exacto de una categoría existente y habilitada en el workspace, o `null` para borrar |
| `summary`, `comments`, `transcription` | Texto opcional, máximo 100.000 caracteres; `null` borra |
| `language` | Etiqueta de idioma BCP 47, por ejemplo `es`, `ca`, `en-US` o `null` |
| `recordingUrl` | URL HTTPS, sin credenciales incrustadas, o `null` |

La asociación segura tiene prioridad: un conflicto de identidad o una referencia ambigua implica revisión humana, aunque el evento indique `INFORMATIONAL`. El estado de la conversación y la confirmación técnica de entrega son dimensiones distintas. Si necesitas actualizar una conversación **sin insertar un nuevo mensaje**, usa `PATCH /rest/supportCases/{id}` con el rol apropiado.

### Llamadas telefónicas

Crea un Canal `PHONE` para la línea o centralita correspondiente. Envía `message.externalId` único para cada llamada, así como un `issueKey` o referencia verificable al hilo, si procede.

```json
{
  "channelCode": "centralita",
  "channelType": "PHONE",
  "provider": "voip",
  "accountId": "linea-1",
  "contact": { "externalId": "caller-123", "name": "Cliente" },
  "message": {
    "externalId": "call-234",
    "issueKey": "call-234",
    "body": "Llamada entrante",
    "callTranscription": "Buenos días, quisiera consultar…",
    "callRecordingUrl": "https://audio.ejemplo.com/call-234"
  },
  "conversation": {
    "status": "INFORMATIONAL",
    "followUp": "NONE",
    "transcription": "Buenos días, quisiera consultar…",
    "recordingUrl": "https://audio.ejemplo.com/call-234"
  }
}
```

**Grabación** es un enlace, no un archivo binario. Las políticas de acceso, autorización para grabar y retención corresponden a la integración del proveedor. Evita enlaces públicos permanentes y credenciales embebidas. La app no realiza ni graba llamadas.
