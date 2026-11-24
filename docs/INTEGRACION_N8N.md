# Integrar Omnichannel Support con n8n y Twenty

Omnichannel Support recibe eventos normalizados de email, WhatsApp, Instagram, Telegram y llamadas telefónicas. n8n se encarga de hablar con el proveedor, autenticar el evento y preparar los datos. La aplicación registra la Persona, la identidad externa, la conversación y el mensaje en Twenty mediante un único endpoint.

La [referencia de API](API_REFERENCE.md) contiene los parámetros y códigos de error.

## Empezar con el nodo comunitario

Actualiza **Omnichannel Support** a **1.4.0** en Twenty. En n8n, abre **Settings → Community Nodes** y actualiza `n8n-nodes-omnichannel-support` a **0.2.0**. Añade un nodo **Omnichannel Support** nuevo y selecciona la misma credencial **Twenty API** que utilizas en **Twenty CRM**. Este tipo de credencial lo registra `@blackswampai/n8n-nodes-twentycrm`. El nodo descubre la URL de las funciones desde el workspace de la credencial. Los nodos v1 guardados siguen utilizando su configuración anterior. [Instalación y actualización de nodos](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/)

### Registrar un WhatsApp en su conversación

Elige **Message → Register Incoming Message**. Configura el canal una vez y mapea tres datos del evento. Para un webhook de WhatsApp Cloud, si el paso anterior ya devuelve el objeto `messages[0]` como ítem de n8n, este es el mapeo de un mensaje de texto.

| Campo del nodo | Valor para ese evento |
| --- | --- |
| **Channel Name or ID** | Selecciona la línea de WhatsApp en la lista del workspace |
| **Contact or Chat ID** | `{{ $json.from }}` |
| **Message Identifier** | `{{ $json.id }}` |
| **Message Text** | `{{ $json.text.body }}` |

Con Baileys, mapea el `key.remoteJid` del chat y el `key.id` del mensaje. Si el proveedor entrega `key.remoteJidAlt`, añádelo en **Contact Fields → WhatsApp Alternate JID**. Los grupos de WhatsApp están fuera del modelo de conversación por persona.

El siguiente mensaje del mismo contacto en esa línea vuelve al chat, incluso después de semanas. Una entrada nueva pone la conversación **En curso** y la fecha de actividad avanza con **Message Fields → Occurred At** si has mapeado la fecha original. De lo contrario se usa la hora de registro. Un reintento con el mismo identificador devuelve `duplicate`. Si hay varios historiales previos compatibles, el resultado indica `reviewRequired: true` para que puedas derivarlo a una persona.

Para elegir otro estado, abre **Conversation Fields → Status Name or ID**. En ese mismo menú puedes añadir etiquetas, categoría, tipo y seguimiento. Las etiquetas seleccionadas sustituyen las anteriores del campo correspondiente. Para aplicar las ventanas de actividad del canal, elige **Routing Fields → Routing Mode → Channel Policy**.

### Crear la Persona

En **Contact Fields**, añade **First Name** y **Last Name** cuando el proveedor los facilite. En un chat directo con una identidad reconocida, el nodo puede crear la Persona con esos datos aunque solo conozcas su WhatsApp. Si la identidad ya está vinculada, se recupera esa Persona. Puedes desactivar **Create Person From Chat Name** si tu flujo solo registra mensajes. Para correo, el remitente identifica a la Persona. Para vincular un chat a una Persona concreta, utiliza **Person ID** y **Verified Contact** cuando hayas comprobado ese vínculo.

### Elegir la operación

| Si tu workflow… | Operación y datos |
| --- | --- |
| Recibe correo | **Message → Register Incoming Message**. Usa la dirección del remitente, el ID del mensaje y el texto. Añade **Routing Fields → Thread ID** con `threadId` de Gmail o `conversationId` de Outlook para agrupar todo el hilo. También puedes mapear **Reply to Provider Message ID** cuando referencia un mensaje registrado. |
| Recibe Instagram o Telegram | **Register Incoming Message** con el canal, el ID del chat directo y el ID del mensaje. En Telegram Bot API, mapea `{{ $json.message.chat.id }}` y `{{ $json.message.message_id }}`. El nodo combina los dos automáticamente para que mensajes de chats distintos puedan tener el mismo número. |
| Registra una llamada | **Register Incoming Message** o **Register Outgoing Message** con la línea, el interlocutor y el ID de la llamada. Añade **Call Transcription** y **Call Recording URL** en **Message Fields**. |
| Ya ha enviado la respuesta por el proveedor | **Message → Register Outgoing Message** con el mismo chat y el ID nuevo del proveedor. Si tienes el `caseId` de una propuesta, **Append Message** permite indicar esa conversación directamente. |
| Recibe un acuse | **Message → Update Delivery Status** con el canal, el ID y el estado. Puedes reutilizar `providerMessageIdentifier` del registro inicial. Para un ID numérico de Telegram, también puedes indicar **Provider Settings → Telegram Chat ID** en el acuse o al añadir por `caseId`. |
| Necesita una respuesta de la base de conocimiento | **FAQ → Search Published FAQs** con la pregunta en **Query**. **Search Options** permite elegir los alcances e idioma. La búsqueda devuelve un ítem con `results` y `count`; la coincidencia mejor puntuada está en `results[0]`. |
| Necesita consultar o editar fichas | Elige el recurso, por ejemplo **FAQ** o **Case**, y la operación de lectura o escritura. **Get Many → Filter by Field** permite elegir estados y etiquetas del workspace y combinar filtros. Puedes limitar el resultado o recuperar todas las páginas. Para escribir, selecciona los campos del workspace y mapea sus valores. |
| Necesita registrar una propuesta | **Message → Propose Reply** con el `messageId` que devolvió el registro inicial. Si ya tienes el borrador al registrar la entrada, activa **Include Proposed Reply**. |

### Autorizar las operaciones de revisión

Para **Propose Reply**, **Include Proposed Reply** y **Append Message**, autoriza una vez la credencial elegida en el workspace. En n8n, ejecuta **Connection → Get Credential Fingerprint** y copia `fingerprint` en la variable **Huella de la credencial Twenty de n8n** (`OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT`) de la app en Twenty. El valor que muestra n8n sirve para reconocer la credencial autorizada. La prueba privada se calcula en el nodo. Si rotas la API key, vuelve a emparejarla. El registro ordinario y la búsqueda de FAQs funcionan con la credencial Twenty sin ese paso.

<a id="revisar-una-respuesta-de-correo-en-twenty"></a>

## Revisar una respuesta en Twenty

1. Configura `OMNICHANNEL_N8N_ORIGIN` con la URL HTTPS pública que sirve Wait. Autoriza la credencial del nodo con su huella como se indica arriba. Configura **Header Auth** en Wait con la cabecera `X-Omnichannel-Webhook-Secret` y guarda el valor de esa cabecera en `OMNICHANNEL_N8N_WAIT_SECRET` de Twenty.
2. Guarda el mensaje con **Register Incoming Message** y conserva el `messageId` que devuelve. Cuando el agente genere un borrador que requiere revisión, pásalo a **Propose Reply** junto con ese `messageId`. El campo **Wait URL** toma por defecto `{{ $execution.resumeUrl }}` de la misma ejecución.
3. Continúa a **Wait → On Webhook Call** si `proposalStatus` es `PENDING`. Configura **POST** y respuesta **Immediately**. Usa un mensaje para revisión por ejecución de Wait. Prueba ejecutando el workflow completo para que la URL corresponda a esa ejecución.
4. En **Conversaciones**, abre el hilo, edita **Respuesta propuesta** y pulsa **Enviar** o **Descartar**. Al reanudarse, envía por el proveedor solo si `$json.body.confirmed === true`. Usa `$json.body.message` como texto definitivo y `$json.body.proposalMessageId` como clave de deduplicación del envío.
5. Tras confirmar el envío con el proveedor, usa **Append Message**. Pasa el `caseId` de Wait, el ID que devolvió el proveedor y el texto que se envió. El historial mostrará la propuesta aceptada y el mensaje saliente.

Conserva la misma URL de Wait y el mismo `messageId` al reintentar **Propose Reply**. Si otra ejecución ya tiene una propuesta pendiente para ese mensaje, verás `PROPOSAL_CALLBACK_CONFLICT`. La URL de Wait se guarda en el almacenamiento privado de la app. Si la decisión sigue pendiente porque el nodo Wait todavía se está activando, comprueba la ejecución y reintenta desde el historial. [Nodo Wait de n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/).

El paquete y su proceso de instalación local están en el [directorio del nodo comunitario](../integrations/n8n-nodes-omnichannel-support/README.md). Si utilizas HTTP Request, los mismos pasos están en la [referencia de API](API_REFERENCE.md#propuestas-de-respuesta).

## Preparar el workspace

Instala Omnichannel Support en una versión compatible de Twenty (el paquete declara `>=2.50.0 <2.51.0`). Abre **Omnichannel → Canales** y crea una instancia por buzón de correo, número, cuenta o centralita.

Cada Canal necesita un `code` único. Define también `channelType`, `provider` y `externalIdentifier` para delimitar su ámbito. Mantén el Canal desactivado mientras pruebas la integración. Configura la política de agrupación por hilo, mensaje, periodo de actividad o revisión.

Si vas a clasificar conversaciones, crea las Categorías en Twenty con `code` y `enabled=true`. Las FAQs también se gestionan desde el workspace. Ninguna de estas configuraciones necesita guardar un token de proveedor en Twenty.

En la versión 2 del nodo, selecciona tu credencial **Twenty API**. La versión 1 admite la credencial original **Omnichannel Support API** con su **Integration Key**. Si configuras HTTP Request, usa la autenticación Bearer del workspace y comprueba la URL externa de la función.

```http
POST https://TU_TWENTY/s/omnichannel/v1/ingest
Authorization: Bearer TOKEN_DEL_WORKSPACE
Content-Type: application/json
```

El nodo v2 consulta la configuración pública de Twenty desde la URL de la credencial. Usa el dominio de funciones del workspace cuando Twenty lo anuncia y la ruta `/s/omnichannel/v2/ingest` en instalaciones que sirven las funciones bajo `/s`. El ejemplo HTTP anterior también sirve para los clientes que usan el contrato v1.

## Subworkflow común

```text
Trigger de proveedor (email / chat / VoIP)
  → Validar firma, autenticación y tipo de evento
  → Omnichannel Support: Register Incoming Message
  → Comprobar status y reviewRequired
  → Si procede, buscar FAQs y ejecutar bot
  → Enviar la respuesta mediante el proveedor
  → Omnichannel Support: Append Message o Update Delivery Status
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

Si ya tienes el `caseId`, usa **Append Message** con el ID del nuevo mensaje y su texto. Twenty toma el canal de la conversación. Cuando también necesites cambiar sus metadatos, usa el contrato de ingestión con `conversation` y una referencia de agrupación. El correo puede usar `threadId` y los chats pueden indicar `issueKey`, `caseId` o `replyToExternalId`.

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


## Formato HTTP de la búsqueda de FAQs

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

La búsqueda lee FAQs publicadas con el rol de Omnichannel Support y el cliente puede solicitar cualquier alcance. Utiliza workspaces separados si necesitas aislar contenido confidencial entre bots. [Seguridad y privacidad](SEGURIDAD.md).


**Twenty 2.50:** el parser REST rechaza tanto `containsIlike` como `containsAny` sobre `scopeTags`. La aplicación realiza la comprobación de alcance después de recuperar los candidatos de texto publicados. Envía únicamente `query`, `scopeTags`, `language` y `limit`. Una respuesta HTTP 502 no es una búsqueda válida.


**Nota de compatibilidad beta.21:** La búsqueda no utiliza `scopeTags` como filtro REST, porque Twenty 2.50 lo rechaza con HTTP 400. La aplicación comprueba el alcance de cada FAQ candidata antes de responder. Las etiquetas guardadas como `General` o `Campus Hivern` se normalizan sin migrarlas. No debes construir filtros REST desde n8n ni modificar la petición `POST`.
