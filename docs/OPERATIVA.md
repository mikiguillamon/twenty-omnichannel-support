# Operación diaria de Omnichannel Support

## Resumen

Abrir **Atención al cliente > Resumen** para revisar Consultas registradas, pendientes humanos, errores técnicos y evaluaciones incorrectas. Estos indicadores son acumulados. Para analizar un periodo concreto, utilizar dashboards con filtros temporales cuando la versión de Twenty lo permita. Si falla una consulta de métricas, revisar permisos o GraphQL; no interpretar los datos ausentes como cero.

## Gestionar Consultas

En Consultas se encuentran las vistas de Email, WhatsApp, Pendientes de agente y Errores técnicos. Abrir una Consulta para revisar sus detalles y el historial de Mensajes. El visor presenta hasta 100 Mensajes en orden cronológico; para conversaciones más largas, consultar la relación nativa de Mensajes.

Cuando se asigne atención humana, utilizar `status=HUMAN_REQUIRED`, registrar `escalatedAt` y completar `assignedTo` si se conoce. Cambiar el estado a `IN_PROGRESS` cuando un agente se haga cargo. Marcar `RESOLVED` o `CLOSED` según el procedimiento de atención adoptado y mantener `resolution` coherente con el resultado comprobado.

## Interpretar los resultados

- `technicalStatus` describe el proceso de automatización, no la satisfacción del cliente.
- `resolution` indica si se solucionó la consulta.
- `automation` registra el grado de intervención automática.
- `supportEvaluations.verdict` recoge una revisión humana, que puede estar pendiente.

Una tasa de calidad necesita su denominador: elementos revisados sobre elementos elegibles. No atribuir la misma tasa a todos los Mensajes cuando solo se evalúa una muestra.

## Canales y FAQs

En Canales, revisar por separado el estado operativo, la salud técnica y las reglas de Gestión de consultas. Los canales existentes pueden requerir guardar su política tras la actualización. Los campos de heartbeat y evento deben proceder de comprobaciones observadas. La pausa o desactivación en Twenty necesita que el workflow externo consulte el estado para detener nuevos envíos.

Publicar FAQs revisadas con `status=PUBLISHED`; mantener borradores en `DRAFT` y archivar respuestas obsoletas. La app no crea automáticamente un historial de revisiones. Los bots deben consultar FAQs por idioma, categoría y publicación.

## Evaluaciones y seguimiento

Evaluar una Consulta completa o un Mensaje individual, indicando `targetScope` y la relación apropiada. Anotar `verdict`, comentario y propuesta de corrección cuando corresponda. Vincular una tarea nativa de Twenty si existe trabajo pendiente, comprobando que la relación `taskId` apunta a la tarea real. El campo textual `linkedTaskId` no reemplaza esa relación.

## Comprobaciones periódicas

Revisar el estado de los Canales, los casos humanos sin responsable, los errores de automatización, las respuestas incorrectas y las FAQs pendientes de actualización. Aplicar políticas de privacidad y retención sobre los datos registrados.

Para las reglas de ingestión y envío, consultar [Integración con n8n](INTEGRACION_N8N.md).
