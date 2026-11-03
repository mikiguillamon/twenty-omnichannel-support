# Contrato API para integraciones n8n

**No modifica workflows existentes.** Esta documentación es un contrato de datos para preparar una integración controlada cuando lo autorices.

## Punto de entrada

`https://<slug>.space.justforfun.es/rest/` con clave propia del workspace: `Authorization: Bearer <clave_del_cliente>`.

Rutas esperadas bajo la API autogenerada de Twenty:

- `supportFaqs`, `supportCategories`, `supportSettings`: lectura de conocimiento y parámetros.
- `supportChannels`: instancias técnicas y sus heartbeats.
- `supportCases`: creación/actualización del hilo.
- `supportMessages`: mensajes entrantes, generados, enviados y resultados de entrega.
- `supportEvaluations`: revisión humana y correcciones.

**Los nombres y los payloads de relaciones deben confirmarse en el API Playground del workspace instalado**, pues la forma de los IDs y filtros varía según la versión real y el esquema generado.

## Identificadores e idempotencia

No uses el teléfono o email como ID único de un hilo para siempre: un contacto puede abrir varios casos. Utiliza claves externas estables, por ejemplo:

- Canal: `email-informacion` / `whatsapp-atencion`.
- Caso: `EMAIL:gmail:thread-123` o `WHATSAPP:evolution:conversation-456-2026-11`.
- Mensaje: `EMAIL:gmail:msg-id-123` o `WHATSAPP:evolution:wamid-456`.
- Evaluación de origen externo: `REVIEW:qa:eval-789`.

Los índices únicos evitan inserciones duplicadas. Ante un conflicto, recupera el registro y actualízalo; no dupliques datos.

## Entrada de mensajes (Email y WhatsApp)

1. Normalizar email y teléfono E.164; consultar Persona y crearla solo si no existe coincidencia segura.
2. Resolver Canal por `code`, verificar que está ACTIVE. Guardar y actualizar la última actividad/heartbeat según el evento real.
3. Buscar Consulta por externalKey. Si no existe, crearla asociada a Persona y Canal; rellenar tanto `channel` (EMAIL/WHATSAPP) como `channelInstance` (relación).
4. Añadir Mensaje INBOUND con externalKey, body, occurredAt, senderType CUSTOMER y deliveryStatus RECEIVED.
5. Consultar FAQs publicadas y categoría/idioma, leer los ajustes de soporte sin secretos.
6. Si el bot decide no responder, guardar decisión SKIP; si propone una respuesta, registrar `draftBody` sin atribuirla todavía como enviada.
7. **Solo tras confirmación del proveedor** registrar el contenido real enviado en `body`, deliveryStatus SENT, sentAt y senderType BOT/AGENT. Para DELIVERED y deliveredAt se requiere acuse de entrega real.
8. Actualizar Consulta con status, resolution, automation y technicalStatus por separado. Si necesita intervención, status HUMAN_REQUIRED y fecha escalatedAt.
9. Si se evalúa la respuesta, crear Evaluación y enlazarla a Consulta o Mensaje. Si requiere mejora, marcar followupStatus y enlazar mediante la relación `task` una tarea nativa real si se ha creado.

El valor `SUCCESS` técnico no demuestra que la consulta se haya resuelto; una evaluación PENDING tampoco equivale a negativa.

## Ejemplo conceptual (NO copiar directamente a HTTP Request)

```json
{
  "supportCase": {
    "name": "Consulta de pedido #42",
    "externalKey": "EMAIL:gmail:thread-42",
    "channel": "EMAIL",
    "channelInstance": "<UUID canal>",
    "person": "<UUID persona>",
    "category": "<UUID categoria>",
    "status": "IN_PROGRESS",
    "technicalStatus": "SUCCESS",
    "resolution": "PENDING",
    "automation": "PENDING"
  },
  "supportMessage": {
    "name": "Respuesta generada",
    "externalKey": "EMAIL:gmail:draft-42-v1",
    "supportCase": "<UUID consulta>",
    "direction": "OUTBOUND",
    "senderType": "BOT",
    "draftBody": "Respuesta propuesta del asistente",
    "replyDecision": "PENDING_REVIEW",
    "deliveryStatus": "PENDING"
  }
}
```

Los campos de relación pueden usar `personId`, `channelInstanceId` o la estructura concreta del Playground. En Twenty, los valores de SELECT deben coincidir con el enum declarado.

## Seguimiento de salud

No confundas heartbeats y errores técnicos de transporte con una respuesta incorrecta del bot. Actualiza por Canal:

- `lastEventAt` cuando realmente llega un evento del proveedor.
- `lastHeartbeatAt` cuando un sondeo/heartbeat termina correctamente.
- `health` HEALTHY/WARNING/CRITICAL/UNKNOWN a partir de una regla comprobable.
- `errorSummary` sin credenciales, direcciones privadas ni cuerpos de mensajes.

Los ajustes `staleAfterMinutes` se pueden cambiar por cliente, pero **su efecto requiere lógica en el workflow que produce el heartbeat**. La aplicación no ejecuta verificaciones externas automáticamente en esta versión.

## Seguridad y límites

- Un token por workspace, con permisos mínimos, guardado en credenciales de n8n.
- No registrar tokens, contenido sensible o trazas privadas en campos de error.
- Filtrar por `status=PUBLISHED` antes de entregar FAQs al bot.
- No completar o aprobar acciones en nombre del cliente sin autorización.
- Establecer retención y supresión antes de producir con datos personales.
