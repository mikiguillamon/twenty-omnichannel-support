# Checklist de validación de Omnichannel Support

Esta lista sirve para probar una instalación nueva o actualizada antes de conectarla a comunicaciones reales.

## Instalación y permisos

- [ ] La versión instalada de Twenty está dentro del rango de compatibilidad declarado por la app.
- [ ] La app muestra los nueve objetos y las relaciones con Persona y Tarea nativas.
- [ ] Se puede crear un Canal, una Categoría, una FAQ y una Consulta desde Twenty.
- [ ] Un usuario operativo con permisos limitados solo accede a los registros autorizados.
- [ ] Las credenciales API están separadas por workspace y no existen secretos en `supportSettings`.

## Integración con n8n

- [ ] El nodo Twenty instalado permite buscar, crear y actualizar los objetos personalizados necesarios.
- [ ] Las relaciones `personId`, `channelInstanceId`, `categoryId` y `supportCaseId` se han probado en esa versión.
- [ ] El Canal empieza `DISABLED` y el workflow consulta `status=ACTIVE` antes de responder.
- [ ] Un webhook recibido dos veces no crea dos Mensajes.
- [ ] Se pueden crear Identidades externas distintas por proveedor/cuenta y vincularlas a Personas y Consultas.
- [ ] Un mismo contacto WhatsApp resuelve la misma identidad mediante JID de teléfono o LID, en cualquiera de los dos campos del evento.
- [ ] Dos alias ya asociados a identidades distintas nunca causan una fusión automática.
- [ ] Los mensajes conservan ambos JID originales y el ID real del mensaje del proveedor.
- [ ] Las políticas de Canal se guardan desde la pestaña Gestión de consultas, y se leen con el nodo Twenty CRM.
- [ ] Email agrupa respuestas en el hilo correcto; WhatsApp, Instagram y Telegram admiten política propia.
- [ ] La app no llama a modelos de IA: cuando está permitida, la clasificación ocurre en n8n.
- [ ] Dos ejecuciones concurrentes con la misma clave recuperan el registro existente.
- [ ] Una Persona puede tener varias Consultas y cada Consulta varios Mensajes.
- [ ] Se prueban los hilos de email y la separación de asuntos de WhatsApp.
- [ ] Un eco de mensaje saliente no se registra como entrada de cliente.
- [ ] `SKIP`, `ESCALATE` y `PENDING_REVIEW` no generan envíos no autorizados.
- [ ] Los mensajes `SENT`, `DELIVERED` y `FAILED` dependen de confirmaciones reales.
- [ ] Pausar el Canal bloquea nuevos envíos, incluso en ejecuciones iniciadas anteriormente.
- [ ] Los errores se pueden reintentar sin duplicar envíos ni borrar el historial.

## UI y supervisión

- [ ] El visor de Consulta muestra Mensajes en orden cronológico con sus estados.
- [ ] Se contempla el límite de 100 mensajes del visor para históricos largos.
- [ ] Las vistas Email, WhatsApp, Pendientes y Errores filtran correctamente.
- [ ] El Resumen muestra datos reales o un error explícito cuando falla la consulta.
- [ ] `technicalStatus`, `resolution`, `automation` y `verdict` se interpretan por separado.
- [ ] Las FAQs solo se entregan al bot cuando están `PUBLISHED`.
- [ ] Las Evaluaciones se asocian a la Consulta o al Mensaje que realmente revisan.

## Operación segura

- [ ] Se ha probado una caída del proveedor y su recuperación.
- [ ] `health` y `lastHeartbeatAt` reflejan comprobaciones, no supuestos.
- [ ] Existe una política para HTML, multimedia y adjuntos.
- [ ] Hay una política de retención y supresión de datos personales.
- [ ] Las actualizaciones se han probado sin pérdida de datos y sin desinstalaciones innecesarias.
- [ ] La integración está validada con datos ficticios antes de activarse.
