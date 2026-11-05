# Identificación de contactos WhatsApp: PN JID, LID y JID alternativo

## Por qué hay dos identificadores

WhatsApp puede representar a una misma cuenta mediante un JID de número (`...@s.whatsapp.net`, denominado PN) y un identificador LID (`...@lid`). Dependiendo del evento, dispositivo, proveedor y versión de Evolution API, pueden aparecer en `data.key.remoteJid` y `data.key.remoteJidAlt`, en distinto orden o solo uno de ellos. No presupongas que `remoteJid` contiene el número ni que `remoteJidAlt` está siempre presente. El ID de mensaje (`data.key.id`) es una dimensión diferente.

## Modelo en Twenty

- `supportExternalIdentities`: identidad lógica de interlocutor por cuenta y proveedor. Puede vincularse a `personId`, pero no hace falta crear una Persona de Twenty hasta que exista información fiable.
- `supportIdentityAliases`: cada PN JID, LID u otro identificador observado se guarda por separado y apunta a una identidad externa mediante `externalIdentityId`. Los campos son `externalKey` (única), `aliasValue`, `aliasType` (`WHATSAPP_PN`, `WHATSAPP_LID`, `PROVIDER_ID`), `evidence`, `lastSeenAt` y `externalIdentityId`.
- `supportMessages`: `providerChatId` y `providerChatIdAlt` guardan los valores originales del evento; `providerAddressingMode` permite registrar el tipo observado y `providerMessageId` guarda el identificador de mensaje del proveedor. No reemplazan `externalKey` ni `supportCaseId`.

El índice único de `supportIdentityAliases.externalKey` evita que dos identidades adquieran el mismo alias sin conflicto. La clave debe incluir tipo, proveedor, **cuenta receptora** e identificador normalizado, por ejemplo `WHATSAPP:evolution:numero-empresa:34600111222@s.whatsapp.net`.

## Flujo con nodos Twenty CRM en n8n

1. Recibir y validar `messages.upsert` del proveedor. Extraer `remoteJid`, `remoteJidAlt`, `key.id`, `fromMe`, `instance` y la fecha; verificar que es un chat individual. Para chats de grupo se necesita una política distinta.
2. Normalizar JIDs válidos, sin interpretarlos como teléfonos genéricos. No descartar el LID ni convertirlo a número; si un identificador lleva sufijo de dispositivo, normalizarlo según la regla del proveedor y conservar el original en el Mensaje.
3. Construir las claves únicas de los alias usando Canal, proveedor y cuenta. Si existen ambos JIDs, buscar **ambos** en `supportIdentityAliases` con `Record → Get Many`. El orden de los campos no determina cuál es la identidad principal.
4. Si ninguno existe, crear una `supportExternalIdentity` lógica, preferentemente con una clave estable independiente de PN/LID cuando se disponga de ella, y crear sus alias relacionados con `externalIdentityId`.
5. Si solo existe uno, reutilizar su identidad y añadir el alias faltante a esa misma identidad, **siempre que se haya observado una vinculación fiable entre ambos en el mismo evento**. Conservar la evidencia sin registrar el contenido privado.
6. Si ambos existen y apuntan a la misma identidad, reutilizarla. Si apuntan a identidades distintas, **no fusionar ni mover Consultas automáticamente**: marcar el conflicto para revisión. Ante inserciones concurrentes con clave duplicada, volver a consultar antes de continuar.
7. Buscar Consultas por `externalIdentityId` y `channelInstanceId`, y aplicar la política de agrupación del Canal. Si el mensaje cita una respuesta registrada, utilizar la Consulta del mensaje citado antes de comprobar ventanas temporales.
8. Buscar el Mensaje por su `externalKey` idempotente basada en `key.id` y el Canal, nunca en `remoteJid` ni `remoteJidAlt`. Guardar `providerChatId`, `providerChatIdAlt`, `providerMessageId`, dirección y relación con la Consulta elegida.
9. Para salidas, utilizar el identificador de chat aceptado por el proveedor y correlacionar acuses por el ID del mensaje enviado; no suponer que la identidad canónica de Twenty sea necesariamente la dirección a la que enviar.

**Importante:** no vincular automáticamente un PN y un LID basándose solo en que aparecen en registros cercanos, nombres iguales o coincidencias de texto. La evidencia debe proceder de una correlación explícita y fiable del proveedor. Cuando llega solo un JID nuevo y no hay correspondencia, crear una identidad sin Persona asociada o pedir revisión. No fusionar con otra Persona por nombre o teléfono no verificado.

## Ejemplo de normalización para n8n

La función `whatsappAliases` de `src/lib/whatsapp-identities.ts` implementa normalización y creación de claves por cuenta, y `resolveAliasLookup` detecta el conflicto de pertenencia si dos alias ya se asignaron a identidades diferentes. Son ayudas puras del repositorio: **no se ejecutan automáticamente desde Twenty ni se instalan dentro de n8n**. Al construir el workflow, replicar las reglas mediante el nodo Twenty CRM y nodos de lógica de n8n.

Para pruebas, verificar las cuatro situaciones: solo PN, solo LID, ambos JIDs del mismo contacto (en cualquier orden), y ambos JIDs previamente vinculados a identidades diferentes. Repetir con dos cuentas receptoras distintas. Confirmar que el evento duplicado no crea alias, Mensajes ni Consultas duplicadas.

La aplicación almacena datos y relaciones; las consultas, validaciones y actuaciones corresponden a n8n. [Políticas de conversación](POLITICAS_CONVERSACION.md).
