# Integrar Omnichannel Support con n8n y Twenty

## Alcance

La app registra historial, consultas, conocimiento y supervisión en el workspace de Twenty. El transporte de email, WhatsApp, Instagram y Telegram y la ejecución del bot corresponden a n8n y a los proveedores. Se recomienda utilizar el **nodo Twenty de n8n** para las operaciones de CRM que soporte la versión instalada. Antes de diseñar el flujo, comprobar en ese nodo que permite buscar, crear y actualizar los objetos personalizados `supportChannels`, `supportExternalIdentities`, `supportIdentityAliases`, `supportCases`, `supportMessages`, `supportFaqs` y sus relaciones.

No se debe asumir soporte para objetos personalizados solo porque el nodo conecte con Twenty. Si una operación no aparece, documentar la incompatibilidad y revisar la versión del nodo; no presentar un ejemplo basado en HTTP como si fuera una acción oficial del nodo. El API Playground del workspace sirve para inspeccionar los nombres y los filtros generados, incluso cuando la implementación utiliza el nodo Twenty.

## Preparación

1. Crear en Twenty un Canal por buzón, número, bot o cuenta real, con `code`, `channelType`, `provider` y `externalIdentifier`. Dejarlo desactivado hasta probar la conexión.
2. Crear las categorías y FAQs necesarias. Solo las FAQs `PUBLISHED` deben usarse para responder.
3. Crear una credencial Twenty en n8n con una API key propia de ese workspace y permisos mínimos.
4. Comprobar operaciones de lectura, búsqueda, creación y actualización de objetos personalizados en el nodo Twenty; validar relaciones en el API Playground.
5. Crear un subworkflow común de escritura en Twenty, llamado por los triggers de cada proveedor. Mantener el envío en el nodo del proveedor.
6. Hacer pruebas con datos ficticios y activar el Canal solo cuando el flujo pueda comprobar `status=ACTIVE` antes de enviar.

Los valores de un mismo workspace nunca se consultan con credenciales de otro. Los tokens y claves de proveedor se guardan en el gestor de credenciales de n8n, no en `supportSettings`.

## Flujo de recepción

```text
Trigger de email / webhook de chat
 -> validar origen, tipo de evento, dirección y duplicados
 -> normalizar cuenta, alias, mensaje y referencia al hilo
 -> nodo Twenty: obtener Canal y su política por code
 -> nodo Twenty: resolver Identidad externa y alias; vincular Persona solo si es fiable
 -> localizar Consultas candidatas y aplicar agrupación por Canal
 -> continuar, reabrir, crear o enviar a revisión la Consulta
 -> nodo Twenty: buscar o crear Mensaje por externalKey
 -> nodo Twenty: leer FAQs publicadas y Ajustes
 -> bot: REPLY / SKIP / ESCALATE / PENDING_REVIEW
 -> si REPLY: crear borrador, comprobar Canal de nuevo, enviar
 -> nodo Twenty: actualizar Mensaje y Consulta con el resultado real
```

### Mapeo de entrada

| Evento normalizado | Twenty |
|---|---|
| Identificador del interlocutor | buscar `supportExternalIdentities` y, si corresponde, sus `supportIdentityAliases` |
| Contacto confirmado | vincular `personId`; registrar `originEmail` o `originPhone` cuando sean datos válidos |
| Cuenta receptora | `supportChannels.code` y relación `channelInstanceId` |
| Tipo de transporte | `supportCases.channel` (`EMAIL`, `WHATSAPP`, `INSTAGRAM` o `TELEGRAM`) |
| Hilo o asunto elegido | `supportCases.externalKey`: una clave única por Consulta, no el JID del contacto |
| ID único del mensaje | `supportMessages.externalKey` |
| ID interno de la Consulta | `supportMessages.supportCaseId` |
| Dirección y autor | `direction=INBOUND`, `senderType=CUSTOMER` |
| Cuerpo y fecha | `body`, `occurredAt` |
| Recepción real | `deliveryStatus=RECEIVED` |

Los campos de relación declarados en el código incluyen `personId`, `externalIdentityId`, `channelInstanceId`, `categoryId`, `supportCaseId` y `taskId`. La interfaz del nodo puede representar la relación como un selector o como un campo ID: comprobarlo en la versión instalada.

## Claves externas y agrupación

Cada Consulta y Mensaje tiene su propia `externalKey` única, estable y con ámbito de proveedor y canal. Ejemplos ficticios:

- Consulta email: `EMAIL:proveedor:cuenta:thread-123`.
- Mensaje email: `EMAIL:proveedor:cuenta:msg-789`.
- Consulta WhatsApp: `WHATSAPP:proveedor:numeroCanal:caso-456`.
- Mensaje WhatsApp: `WHATSAPP:proveedor:numeroCanal:wamid-789`.

El correo puede agruparse por el identificador de hilo del proveedor y las cabeceras `Message-ID`, `In-Reply-To` y `References`. El `Message-ID` por sí solo identifica un correo, no toda la conversación. En WhatsApp, el PN JID y el LID son alias que pueden representar al mismo interlocutor. Su correspondencia se resuelve antes de buscar Consultas; ninguno debe convertirse en la clave permanente de un caso. Aplicar las reglas del Canal para continuar, reabrir o crear una Consulta.

Buscar antes de crear y, cuando una inserción falle por índice único, recuperar el registro existente. Dos ejecuciones concurrentes pueden superar a la vez la búsqueda previa. Los IDs de ejecución de n8n sirven para diagnóstico, no como claves de idempotencia.

## Respuesta y confirmaciones

- `REPLY`: crear o actualizar un Mensaje `OUTBOUND`, `senderType=BOT`, `draftBody` y `deliveryStatus=PENDING`.
- `SKIP`: registrar decisión y no inventar una salida.
- `ESCALATE`: poner Consulta `HUMAN_REQUIRED`, fijar `escalatedAt` y asignar responsable cuando se sepa.
- `PENDING_REVIEW`: guardar borrador hasta aprobación; no enviarlo automáticamente.

Antes de enviar, volver a consultar `supportChannels.status`. Cuando el proveedor acepte el envío, poner el contenido efectivamente enviado en `body`, `deliveryStatus=SENT` y `sentAt`. Con acuse explícito de entrega, actualizar el mismo Mensaje a `DELIVERED` y añadir `deliveredAt`. Un rechazo debe producir `FAILED`, no `SENT`.

Los proveedores pueden enviar notificaciones de mensajes propios y eventos de estado. Correlacionar por el ID de origen para actualizar el Mensaje saliente, sin crear un nuevo Mensaje `INBOUND`. El esquema incluye `supportMessages.providerMessageId` para guardar el ID original del mensaje del proveedor y `providerChatId`/`providerChatIdAlt` para conservar las direcciones recibidas. Usar estas referencias para correlacionar acuses, conservando estable `externalKey`. El campo `externalKey` no debe cambiar a mitad de un envío.

## Estados y supervisión

`supportCases.status` indica el trabajo pendiente; `resolution` indica si el problema quedó solucionado; `technicalStatus` indica si el workflow funcionó; `automation` registra cuánto se automatizó. No mezclar sus métricas. `supportEvaluations.verdict` registra una evaluación humana separada.

Actualizar la salud de cada Canal solamente con hechos observados: `lastEventAt` por evento, `lastHeartbeatAt` tras comprobación, `health` desde una regla explícita, y `errorSummary` sin información privada. `staleAfterMinutes` no ejecuta ninguna comprobación por sí mismo.

## Pruebas antes de producción

- Dos entregas del mismo webhook producen un solo Mensaje.
- Un mismo asunto genera una Consulta con varios Mensajes; un nuevo asunto puede crear otra.
- Los mensajes emitidos por el bot no regresan como mensajes del cliente.
- Un borrador pendiente no figura como enviado y `SKIP` no genera mensajes falsos.
- Los acuses de entrega actualizan el mismo registro.
- Una pausa del Canal impide nuevos envíos.
- Un error técnico puede coexistir con una resolución todavía pendiente.
- Las credenciales y los datos permanecen aislados por workspace.
- Las operaciones y relaciones del nodo Twenty están verificadas en esa instalación.

## Limitaciones que hay que contemplar

La aplicación no tiene compositor de salida propio, no almacena archivos adjuntos en una relación específica de Mensajes, y el visor cronológico muestra como máximo 100 Mensajes. El manejo de HTML, multimedia y conversaciones largas requiere un procedimiento complementario. Las actualizaciones de esquema y del nodo Twenty deben comprobarse en un entorno de pruebas.

Consulta [ARQUITECTURA.md](ARQUITECTURA.md), [OPERATIVA.md](OPERATIVA.md), [CONFIGURACION_CANALES.md](CONFIGURACION_CANALES.md) y [CHECKLIST_PILOTO.md](CHECKLIST_PILOTO.md).

## Políticas e identidades externas

Antes de buscar la Persona, obtener el Canal por `code` con **Record → Get Many** y leer su política de agrupación. Resolver `supportIdentityAliases` mediante todas las direcciones recibidas (incluidos PN JID/LID), recuperar la identidad lógica en `supportExternalIdentities` y crear registros solo cuando falten y vincularlo a Persona solo si existe evidencia fiable. Las Consultas nuevas pueden incluir `externalIdentityId` aunque no haya una Persona identificada. Canal y Consulta admiten `EMAIL`, `WHATSAPP`, `INSTAGRAM` y `TELEGRAM`. La compatibilidad del modelo no configura automáticamente el transporte externo.

Para email, usar el `groupingMode=THREAD` por defecto y las cabeceras/ID de hilo, conservando respuestas dentro de la misma Consulta. Para chats, aplicar `HYBRID` o el modo seleccionado; un clasificador opcional se ejecuta en n8n, nunca dentro de Twenty. `ambiguousAction=REVIEW` exige persistir el mensaje y crear una revisión segura. Las políticas de los Canales antiguos pueden ser nulas hasta que se guarden desde la interfaz. [Procedimiento completo](POLITICAS_CONVERSACION.md).

## WhatsApp: identificadores PN y LID

Para Evolution API, no asumir que `remoteJid` siempre contiene el teléfono. `remoteJidAlt` puede traer el PN o el LID y ambos pueden intercambiarse. Leer los dos, consultar `supportIdentityAliases` con el nodo Twenty CRM y reutilizar la misma identidad lógica cuando exista una vinculación fiable. No fusionar identidades en conflicto. Conservar en el Mensaje `providerChatId`, `providerChatIdAlt` y `providerMessageId` para trazabilidad; la clave idempotente del Mensaje se deriva del ID de mensaje y Canal, no de un JID. Véase [IDENTIFICADORES_WHATSAPP.md](IDENTIFICADORES_WHATSAPP.md).
