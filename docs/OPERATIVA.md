# Uso diario de Omnichannel Support

## Resumen

En la barra lateral de Twenty abre **Atención al cliente → Resumen**. Allí verás total de consultas registradas, pendientes de atención humana, errores técnicos y respuestas evaluadas como incorrectas. Son contadores **acumulados**, no una tasa de éxito ni una métrica de un periodo. Las tablas permiten abrir los registros.

Para comparativas semanales/mensuales y ratios, usa los widgets de los dashboards nativos de Twenty con filtros de fecha: consulta `DASHBOARD.md`.

## Revisión rápida

1. Abre **Pendientes de agente**: asigna un responsable y cambia status a IN_PROGRESS cuando se haga cargo.
2. Abre **Errores técnicos**: identifica problemas del proveedor/bot. No marques la consulta como resuelta solo porque el workflow volvió a funcionar.
3. Abre **Respuestas incorrectas**: anota la corrección y crea una tarea nativa de Twenty si hay trabajo pendiente.
4. Revisa **Canales**: el último evento, el heartbeat y el estado de salud deben tener sentido. Sin heartbeat reciente no implica automáticamente cero actividad.
5. Comprueba las FAQs: un borrador no debe ser suministrado al bot.

## Estado técnico vs resultado vs evaluación

- `technicalStatus=SUCCESS`: el pipeline finalizó correctamente.
- `resolution=SOLVED`: el asunto quedó solucionado según la evidencia disponible.
- `verdict=CORRECT`: una persona evaluó una consulta o respuesta concreta como correcta.

Nunca agregues los tres como un único porcentaje de éxito. La satisfacción humana debe mostrar la cobertura: **número de elementos evaluados / número de elementos elegibles**.

## Canales

Una instancia de canal es un buzón o número concretos. Se puede crear otra instancia sin cambiar el código. `status=ACTIVE` permite operar; `health=HEALTHY` indica que la última comprobación conocida fue correcta. Ambos son campos independientes.

## FAQ y categorías

Las categorías son registros de Twenty y cada cliente las configura. Las FAQs pueden estar en DRAFT, PUBLISHED o ARCHIVED. Publicar una FAQ implica cambiar su estado y registrar publishedAt/revision con un workflow o procedimiento de edición; la app **no mantiene historial de versiones automáticamente** en esta beta.

## Evaluaciones

Puedes evaluar una Consulta completa o un Mensaje. Elige targetScope y relaciona el registro correcto. Escribe comentario y, si procede, proposedCorrection; usar followupStatus para seguimiento. Los campos vinculados al mensaje y la consulta no se validan de forma cruzada automáticamente en esta beta: la integración debe evitar evaluar un mensaje de otra consulta.
