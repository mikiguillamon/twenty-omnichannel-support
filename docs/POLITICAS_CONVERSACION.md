# Políticas de conversación por canal

Omnichannel Support permite decidir cómo se agrupan los mensajes en Consultas de Twenty. Cada buzón, número o cuenta dispone de su configuración independiente dentro del workspace.

**La aplicación guarda las reglas; n8n las ejecuta.** Guardar una política no crea una automatización, no inicia el bot y no llama a ningún modelo de IA.

## Configurar desde Twenty

1. Abrir **Atención al cliente → Canales → Gestión de consultas**.
2. Elegir el Canal concreto. No se comparten valores entre distintos Canales.
3. Seleccionar una estrategia y, en los chats, ajustar ventanas de continuidad y reapertura.
4. Si se utiliza la estrategia inteligente, decidir si n8n puede llamar a un clasificador cuando exista ambigüedad y fijar la confianza mínima.
5. Elegir qué ocurre cuando la Consulta correspondiente no puede determinarse: revisión humana (recomendado) o Consulta nueva.
6. Mantener el cierre automático desactivado hasta disponer de un workflow que excluya los casos pendientes de atención humana.
7. Guardar. El workflow de n8n deberá leer los campos de `supportChannels` antes de agrupar cada mensaje.

Los Canales existentes no se borran. Sus campos de política pueden estar vacíos tras actualizar la app; el editor presenta valores predeterminados según el tipo y los persiste al pulsar Guardar.

## Modos de agrupación

| Código | Uso | Comportamiento en n8n |
|---|---|---|
| `THREAD` | Email | Una Consulta por hilo del proveedor. Las respuestas mantienen el mismo caso |
| `MESSAGE` | Email o chats | Cada entrada sin correspondencia previa inicia una Consulta. Una respuesta a un mensaje conocido utiliza ese caso |
| `HYBRID` | WhatsApp, Instagram, Telegram | Combinar referencia explícita, estado, actividad y tema; consultar IA solamente si hay dudas |
| `SESSION` | Chats | Utilizar el último caso elegible si la inactividad está dentro del umbral; crear otro al superarlo |
| `MANUAL` | Cualquier canal | Registrar el evento de forma pendiente y solicitar clasificación humana |

**Email:** `THREAD` es la opción predeterminada. Si el proveedor ofrece `threadId`, componer una clave que incluya proveedor y cuenta. En IMAP, usar `Message-ID`, `In-Reply-To` y `References` para localizar el hilo. No usar el asunto del email como única clave. En `MESSAGE`, las respuestas a un correo conocido deben quedar en la Consulta de ese correo, sin crear un caso por cada salida.

**Chats:** `HYBRID` es la opción predeterminada. Los mensajes citados o respuestas de bots que ya incluyen el ID de la Consulta deben vincularse directamente. El umbral de continuidad de 72 horas es un valor inicial, no una regla de WhatsApp o Telegram. La IA solo decide casos dudosos y debe recibir el resumen y estado de las Consultas candidatas, no toda la conversación indiscriminadamente.

## Campos de política en supportChannels

| Campo | Tipo | Predeterminado en canales nuevos |
|---|---|---|
| `groupingMode` | SELECT | `THREAD` para Email; `HYBRID` para chats |
| `continuationHours` | NUMBER | `72` |
| `reopenHours` | NUMBER | `48` |
| `semanticClassification` | BOOLEAN | Desactivado en Email; activado en chats |
| `minClassificationConfidence` | NUMBER | `0.8` |
| `ambiguousAction` | SELECT | `REVIEW` |
| `autoCloseEnabled` | BOOLEAN | `false` |
| `autoCloseDays` | NUMBER | `7` (solo si se activa) |

Los rangos validados por la interfaz son: continuidad 1-8760 horas, reapertura 0-8760 horas, confianza 0,5-1 y cierre 1-365 días. Cuando un workflow lea un Canal anterior a esta función con campos vacíos, debe aplicar exactamente los mismos valores predeterminados o exigir que se guarden explícitamente desde la interfaz.

`semanticClassification=true` es una autorización para que n8n use un clasificador configurado aparte. Las credenciales y el modelo de IA residen en n8n.

## Identidades externas: supportExternalIdentities

Los identificadores del interlocutor se guardan en objetos separados para no convertir un JID o un ID de Instagram en la clave de una Consulta. `supportExternalIdentities` es la identidad lógica; `supportIdentityAliases` conserva los identificadores PN, LID u otros alias observados:

| Campo | Uso |
|---|---|
| `externalKey` | Clave estable y única de la identidad lógica en el ámbito de proveedor y cuenta; no sustituirla cuando cambie un JID |
| `provider` | Proveedor del evento |
| `externalUserId` | Identificador principal informativo, que puede mantenerse aunque existan varios alias |
| `externalAccountId` | Número/cuenta/bot de origen |
| `channelInstanceId` | Relación a Canal |
| `personId` | Relación opcional a Persona nativa |
| `displayName` | Nombre proporcionado por proveedor, cuando exista |
| `verified` | Señala si la vinculación a Persona está confirmada |
| `lastSeenAt` | Actividad más reciente |

`supportCases.externalIdentityId` permite localizar las Consultas de una identidad, aunque todavía no se haya reconocido con confianza a una Persona.

Los alias se guardan por separado en `supportIdentityAliases` con `externalKey`, `aliasValue`, `aliasType`, `externalIdentityId`, `evidence` y `lastSeenAt`.

En WhatsApp, `remoteJid` y `remoteJidAlt` pueden intercambiar el orden PN/LID. Buscar ambos alias y resolver el mismo `externalIdentityId`; no asumir que el PN siempre es el principal. Ante un conflicto de dos identidades, solicitar revisión. Consultar [IDENTIFICADORES_WHATSAPP.md](IDENTIFICADORES_WHATSAPP.md).

La identidad no debe identificarse solamente por el teléfono: los proveedores pueden usar IDs de alcance restringido, aliases o LIDs. Dos identidades solo se vinculan a la misma Persona cuando existe una coincidencia fiable. Mantener el identificador original, el de la cuenta receptora y la procedencia. En Telegram, preferir el ID estable de usuario al nombre de usuario editable; identificar el chat individual, sin confundir usuario, bot y grupo.

## Pasos con el nodo Twenty CRM de n8n

1. Recibir el evento desde el proveedor, descartar duplicados y ecos propios, y normalizar `provider`, `channelCode`, los identificadores de interlocutor, `externalMessageId`, `threadId`, fecha y dirección.
2. **Record → Get Many** sobre `supportChannels`, filtrando por `code`. Leer su política. Aplicar valores predeterminados cuando los campos estén vacíos.
3. **Record → Get Many** sobre `supportIdentityAliases` buscando todos los alias que entregue el proveedor, después recuperar la `supportExternalIdentity` relacionada. Si no existe ninguna, **Record → Create** una identidad lógica y sus alias. Si existe solo un alias, añadir los otros únicamente cuando se observe una correlación fiable. Si dos alias están vinculados a identidades distintas, parar para revisión. Vincular `personId` únicamente cuando la Persona sea identificable con seguridad.
4. Consultar Consultas por `externalIdentityId` y `channelInstanceId`, comenzando por las elegibles más recientes. Buscar primero referencias explícitas a un mensaje/caso conocido.
5. Aplicar `groupingMode` y ventanas. Si es `HYBRID` y la clasificación está activada, solicitar a la IA de n8n una decisión estructurada `CONTINUE|REOPEN|NEW|REVIEW` con un ID de caso candidato. Validar el ID y su pertenencia al Canal e identidad antes de aceptarlo.
6. Si hace falta una Consulta nueva, **Record → Create** en `supportCases` con `externalIdentityId`, `personId` si existe, `channelInstanceId`, `channel` y una `externalKey` de caso nueva.
7. **Record → Get Many** sobre `supportMessages` para comprobar la `externalKey` del evento. Crear una sola vez el Mensaje con `supportCaseId`. En una carrera, recuperar el registro ya creado tras un error de clave única.
8. Actualizar `lastMessageAt` sin retroceder fechas. Actualizar respuestas y acuses en el mismo Mensaje, sin volver a procesarlos como entradas.
9. Si `ambiguousAction=REVIEW`, conservar el mensaje en una Consulta provisional `HUMAN_REQUIRED` o en un proceso de revisión que garantice la persistencia, sin asignarlo arbitrariamente a otro caso.

No activar cierre automático de una Consulta `HUMAN_REQUIRED`; evitar terminar casos con borradores pendientes de aprobación. La API de Twenty y el nodo nativo son el sistema de lectura/escritura. No se requiere un endpoint privado adicional de Omnichannel.

## Actualizar instalaciones existentes

Conservar las UUID universales de objetos y campos actuales. La app incorpora objetos nuevos y campos adicionales, sin reemplazar ni borrar Consultas, Mensajes o Canales. Tras instalar una versión compatible, visitar la pestaña de políticas y guardar la configuración de los Canales existentes; no suponer que una política vacía equivale a `THREAD` en WhatsApp.

Probar con datos ficticios cada tipo de Canal, las identidades externas, las relaciones `personId`, `externalIdentityId`, `channelInstanceId`, los filtros del nodo Twenty, y la separación entre workspaces. Los canales de Telegram e Instagram requieren sus proveedores y triggers externos; la app no los configura automáticamente.

Consulta [INTEGRACION_N8N.md](INTEGRACION_N8N.md), [CONFIGURACION_CANALES.md](CONFIGURACION_CANALES.md) y [CHECKLIST_PILOTO.md](CHECKLIST_PILOTO.md).
