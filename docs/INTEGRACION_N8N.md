# Integrar Omnichannel Support con n8n y Twenty

Omnichannel Support recibe eventos normalizados de email, WhatsApp, Instagram, Telegram y llamadas telefónicas. n8n se encarga de hablar con el proveedor, autenticar el evento y preparar los datos. La aplicación registra la Persona, la identidad externa, la conversación y el mensaje en Twenty mediante un único endpoint.

Este procedimiento corresponde al contrato de la versión de código `0.3.0-beta.14`. La [referencia de API](API_REFERENCE.md) contiene todos los parámetros y códigos de error.

## Preparar el workspace

Instala Omnichannel Support en una versión compatible de Twenty (el paquete declara `>=2.50.0 <2.51.0`). Abre **Omnichannel → Canales** y crea una instancia por buzón de correo, número, cuenta o centralita.

Cada Canal necesita un `code` único. Define también `channelType`, `provider` y `externalIdentifier` para delimitar su ámbito. Mantén el Canal desactivado mientras pruebas la integración. Configura la política de agrupación por hilo, mensaje, periodo de actividad o revisión.

Si vas a clasificar conversaciones, crea las Categorías en Twenty con `code` y `enabled=true`. Las FAQs también se gestionan desde el workspace. Ninguna de estas configuraciones necesita guardar un token de proveedor en Twenty.

En n8n crea una credencial de tipo Bearer para el workspace, con los permisos adecuados. Comprueba la URL externa de la función antes de construir el flujo:

```http
POST https://TU_TWENTY/s/omnichannel/v1/ingest
Authorization: Bearer TOKEN_DEL_WORKSPACE
Content-Type: application/json
```

La app registra internamente la ruta `/omnichannel/v1/ingest`. La URL pública puede variar con el dominio de funciones de Twenty y el routing del workspace.

## Subworkflow común

```text
Trigger de proveedor (email / chat / VoIP)
  → Validar firma, autenticación y tipo de evento
  → Normalizar datos en Edit Fields / Code
  → HTTP Request a Omnichannel /ingest
  → Comprobar status y reviewRequired
  → Si procede, buscar FAQs y ejecutar bot
  → Enviar la respuesta mediante el proveedor
  → Registrar un evento message.sent o message.status
```

El subworkflow no necesita llamar por separado a las operaciones de creación de Personas, identidades, conversaciones y mensajes. Esas búsquedas y relaciones se resuelven desde la aplicación en el contexto del workspace.

Si el Canal está `PAUSED` o `DISABLED`, bloquea el envío automático desde el flujo. El endpoint de ingestión no consulta el estado operativo para rechazar eventos entrantes. Mantén el registro entrante si tu política lo requiere, pero aplica la prohibición de envío donde corresponde.

## Formato de entrada

Envía siempre una clave idempotente. Lo habitual es utilizar el ID original del proveedor en `message.externalId`. Cuando no exista, genera una `idempotencyKey` estable de tu sistema.

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "contact": { "email": "cliente@example.com", "name": "Alex" },
  "message": {
    "externalId": "msg-123",
    "threadId": "thread-45",
    "direction": "INBOUND",
    "body": "Hola, quisiera información."
  },
  "conversation": {
    "status": "IN_PROGRESS",
    "categoryCode": "INFORMACION",
    "followUp": "REQUIRED",
    "language": "es"
  }
}
```

`conversation` es opcional. Puedes utilizarlo tanto para el primer mensaje de una conversación como para un nuevo mensaje que actualice sus metadatos. Se aceptan `status`, `followUp`, `followUpAt`, `categoryCode` o `categoryId`, `summary`, `comments`, `language`, `transcription` y `recordingUrl`.

Un campo omitido mantiene el valor anterior. Los reintentos con el mismo identificador de mensaje no vuelven a aplicar el bloque `conversation`. Para cambiar solo el estado, sin crear mensaje, usa `PATCH /rest/supportCases/{id}` mediante la API REST estándar de Twenty.

### Actualizar una conversación al añadir un mensaje

Mantén la referencia a la misma conversación, pero utiliza otro `externalId` para el mensaje. El correo puede usar `threadId`; los chats pueden indicar `issueKey`, `caseId` o `replyToExternalId`. La función valida que la conversación pertenece al Canal y al interlocutor correcto.

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "contact": { "email": "cliente@example.com" },
  "message": {
    "externalId": "msg-124",
    "threadId": "thread-45",
    "direction": "OUTBOUND",
    "senderType": "BOT",
    "deliveryStatus": "SENT",
    "body": "Hemos recibido tu solicitud."
  },
  "conversation": {
    "status": "AUTOMATED",
    "followUp": "NONE",
    "summary": "Se ha enviado una respuesta informativa."
  }
}
```

Los estados disponibles incluyen `AUTOMATED` e `INFORMATIONAL` para comunicaciones que no requieren atención humana. Si la identidad o la relación con el hilo es ambigua, la función obliga a revisar el caso.

## Agrupación automática por canal

Desde la configuración del canal, selecciona **Agrupación automática: identidad y continuidad (HYBRID)** o **Por sesión de actividad (SESSION)**. El endpoint de Omnichannel aplica la política sin que n8n tenga que buscar previamente Personas o Conversaciones. La ventana de continuidad predeterminada es de 72 horas; la de reapertura de conversaciones `RESOLVED` es de 48 horas. Se aplican las horas guardadas en cada canal, no límites universales de WhatsApp.

Al recibir un mensaje nuevo, Twenty resuelve la identidad en el ámbito del canal y de su cuenta y busca conversaciones elegibles. Una sola coincidencia segura se reutiliza; varias coincidencias compatibles con la actividad reciente se envían a revisión o generan una consulta nueva, según `ambiguousAction`. Las conversaciones `AUTOMATED` e `INFORMATIONAL` también pueden continuar. Las `CLOSED` no se reabren automáticamente. Las `RESOLVED` solo pueden reabrirse dentro de la ventana configurada cuando el nuevo evento solicita un estado activo.

Las notificaciones autónomas cuyo `issueKey` empieza por `standalone-auto:` pueden continuar una conversación elegible a pesar de generar claves distintas por mensaje. Si no hay ninguna elegible, se crea una nueva. Un `caseId`, una referencia a mensaje o un `issueKey` de negocio explícitos conservan prioridad y se verifican contra canal e interlocutor.

Para WhatsApp saliente, `contact.phone` en formato **E.164**, como `+34600111222`, se normaliza a la identidad PN `34600111222@s.whatsapp.net`, incluso si el caller omite `channelType`. Para mensajes entrantes, pasa `contact.externalId` o los `remoteJid`/`remoteJidAlt` reales del proveedor. Cuando el proveedor solo entrega un LID sin alias PN conocido, la app no puede deducir con seguridad el número asociado. No se fusionan personas por un teléfono sin identidad verificable.

Cada nuevo mensaje debe tener su `externalId` (o `idempotencyKey`) propio y conservar el mismo `channelCode` y `accountId` de la cuenta. El bloque `conversation` actualiza el estado y seguimiento de la conversación reutilizada. La retransmisión del mismo ID no reescribe el estado. Los eventos `message.status` modifican únicamente la entrega. El caso nunca debe identificarse usando exclusivamente el teléfono como clave permanente.

## Confirmación de envío y entrega

Después de enviar un mensaje, el proveedor puede devolver un acuse de entrega. Regístralo como `message.status`, conservando exactamente su ID:

```json
{
  "channelCode": "email-soporte",
  "channelType": "EMAIL",
  "provider": "gmail",
  "accountId": "soporte@example.com",
  "eventType": "message.status",
  "message": {
    "externalId": "msg-124",
    "deliveryStatus": "DELIVERED"
  }
}
```

Este evento actualiza el mensaje existente. No crea otro, ni cambia el estado de la conversación. El flujo no debe incluir un bloque `conversation` en estas notificaciones.

Los estados `DELIVERED` y `FAILED` se consideran terminales en la función; un acuse tardío de `SENT` no debe retroceder una entrega confirmada. Los mensajes salientes con un ID nuevo deben coincidir con los que se registran después en los acuses.

## WhatsApp, PN y LID

Cuando el proveedor entrega `remoteJid` y `remoteJidAlt`, consérvalos en `contact` o en `message`. La función reconoce los alias `@s.whatsapp.net` y `@lid` para una identidad externa del Canal. Nunca los utilices como clave única de la conversación completa.

Ante alias que ya apuntan a identidades diferentes, la aplicación requiere revisión. No fusiona Personas arbitrariamente. Los chats de grupos `@g.us` quedan excluidos del endpoint de Personas.

Consulta [Identificadores WhatsApp](IDENTIFICADORES_WHATSAPP.md) para los casos de PN/LID y cambios de direccionamiento.

## Llamadas telefónicas

La integración de llamadas funciona con un Canal `PHONE`. Tu centralita sigue siendo responsable de iniciar, recibir, grabar y transcribir. Envía el ID único de llamada en `message.externalId`.

```json
{
  "channelCode": "centralita",
  "channelType": "PHONE",
  "provider": "voip",
  "accountId": "linea-1",
  "contact": { "externalId": "caller-1", "name": "Cliente" },
  "message": {
    "externalId": "call-123",
    "issueKey": "call-123",
    "body": "Llamada recibida",
    "callTranscription": "Buenos días, llamo por una factura.",
    "callRecordingUrl": "https://audio.example.com/call-123"
  },
  "conversation": {
    "status": "WAITING_INTERNAL",
    "followUp": "REQUIRED",
    "transcription": "Buenos días, llamo por una factura.",
    "recordingUrl": "https://audio.example.com/call-123"
  }
}
```

Twenty almacena referencias HTTPS, no el archivo de audio. Protege las grabaciones, establece una retención adecuada y cumple los requisitos aplicables para grabar llamadas.

## Interpretar la respuesta

El endpoint puede devolver `201 created`, `200 duplicate` o `200 status_updated`. Las respuestas incluyen `channelId`, `identityId`, `personId`, `caseId`, `messageId`, `reviewRequired` y `stableId`.

Un `reviewRequired=true` obliga a revisar la asociación o la conversación antes de automatizar su respuesta. Si devuelve `stableId=false`, faltó el identificador estable: no actives reintentos automáticos en esas condiciones.

Un error `502 INGESTION_FAILED` puede ocurrir después de escribir parte de los registros. Reintenta con el mismo ID estable. No inventes otro identificador para evitar un duplicado: esa práctica multiplica las conversaciones.

## Leer datos para bots y dashboards

La función de ingestión se ocupa de registrar. Para leer FAQs, categorías, políticas o listas utiliza las operaciones del nodo Twenty que soporte tu versión, o la REST API generada. Comprueba los nombres y permisos en el API Playground.

En **Omnichannel → Resumen** los KPIs se consultan por REST, y puedes elegir los contadores visibles por workspace. Para gráficas y filtros de periodo utiliza los dashboards nativos de Twenty.

## Pruebas recomendadas

- Un mensaje entrante y su repetición producen un solo mensaje en Twenty.
- Una respuesta con un nuevo ID se incorpora a la misma conversación cuando se identifica con seguridad.
- El segundo mensaje puede actualizar el estado sin borrar resumen o categoría no incluidos.
- Una notificación de entrega modifica el mensaje existente y deja intacto el estado de la conversación.
- Un chat con PN y LID no crea dos identidades incompatibles.
- Una vinculación dudosa se deriva a revisión sin asociar una Persona por suposición.
- Un Canal desactivado impide el envío desde n8n.
- Una llamada registra su transcripción y el enlace protegido al audio.
- Los tokens de cada workspace están aislados y no se guardan en el JSON.

Documentación relacionada: [API Reference](API_REFERENCE.md), [Arquitectura](ARQUITECTURA.md), [Políticas por canal](POLITICAS_CONVERSACION.md), [Seguridad](SEGURIDAD.md) y [Checklist de pruebas](CHECKLIST_PILOTO.md).


## Buscar FAQs aprobadas con un HTTP Request (beta.20)

No hay que dar de alta bots ni generar claves adicionales. El endpoint acepta la **misma credencial Bearer del workspace** que ya utilizas con Twenty. El campo `scopeTags` delimita qué FAQs consultar, y siempre se suma `GENERAL`.

Configuración de un nodo **HTTP Request** en n8n:

- **Method:** `POST`
- **URL:** `https://TU-TWENTY/s/omnichannel/v1/faqs/search`
- **Authentication:** credencial Bearer para Twenty, almacenada en las credenciales de n8n.
- **Body Content Type:** `JSON`

```json
{
  "query": "{{ $('Preparar consulta').item.json.pregunta }}",
  "scopeTags": ["VERANO"],
  "language": "auto",
  "limit": 5
}
```

`scopeTags: ["VERANO"]` incluye FAQs publicadas con `VERANO` o `GENERAL`. Si se omite `scopeTags`, solo incluye `GENERAL`. La API no devuelve FAQs en borrador, archivadas o sin alcance. Un resultado vacío significa que el agente no tiene una respuesta encontrada y debe evitar inventarla.

**Importante:** la etiqueta no impide que el mismo token de Twenty consulte otro alcance. Para aislar información de verdad, utiliza credenciales/workspaces con permisos adecuados. No es necesario modificar los workflows existentes; puedes añadir este nodo cuando quieras incorporar búsqueda de FAQs.


**Twenty 2.50:** `scopeTags` es ARRAY. El servidor aplica `scopeTags[containsIlike]`, nunca `containsAny`. En n8n envía únicamente `query`, `scopeTags`, `language` y `limit`. No consideres una respuesta HTTP 502 como una FAQ consultada correctamente.
