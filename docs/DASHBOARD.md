# Dashboard de atención — enfoque Captia, usando Twenty

## Navegación incluida en la app

La app incluye una **standalone page** `Atención al cliente → Resumen` con:

- KPI acumulados de Consultas, pendientes humanos, errores técnicos y evaluaciones incorrectas.
- Tabla nativa de Consultas pendientes de agente.
- Tabla nativa de errores técnicos.

La primera fuente de métricas es una consulta `totalCount` de la API GraphQL del mismo workspace. No se sustituye la API por una base de datos nueva. El componente necesita permiso de lectura a los objetos consultados; si falla, muestra aviso y guiones, no ceros falsos.

**Se debe verificar** en el workspace piloto el nombre de los filtros y campos GraphQL (`supportCases`, `technicalStatus`, `supportEvaluations`): el SDK se ha escrito para Twenty 2.50, pero no se ha podido ejecutar contra el servidor en esta fase.

## Widgets recomendados en el dashboard NATIVO de Twenty

En **Dashboards → New Dashboard**, crear un dashboard `Atención multicanal` y configurar:

| Pestaña | Tipo | Fuente | Agrupación/filtro |
|---|---|---|---|
| Resumen | Aggregate | supportCases | total por periodo |
| Resumen | Aggregate | supportCases | status HUMAN_REQUIRED |
| Resumen | Aggregate | supportCases | resolution SOLVED |
| Resumen | Aggregate | supportCases | automation FULL |
| Actividad | Line | supportCases | createdAt por semana |
| Actividad | Bar | supportCases | canal (channel) |
| Actividad | Pie | supportCases | categoría (relation) si la UI permite este agrupamiento |
| Calidad | Bar | supportEvaluations | verdict |
| Calidad | Table | supportEvaluations | INCORRECT |
| Salud | Table | supportChannels | health / lastEventAt |

Las tablas pueden permitir edición desde el widget, si el rol del usuario lo permite. No dar por hecha la compatibilidad de cada agrupación: validar en el editor nativo de Twenty del piloto.

**Limitaciones en Twenty 2.50:** los filtros de periodo se configuran por widget, no existe un filtro global de dashboard que propague a todos los widgets; tampoco hay exportación/replicación automática de dashboards nativos entre workspaces. Para replicar sin consola, la página `Resumen` incluida en la app cubre la supervisión principal; el dashboard de análisis avanzado queda como receta configurada por workspace.

## KPIs y criterios de verdad

Separar siempre:

- **Operación:** consultas creadas/resueltas, abiertas, escaladas, tiempo de resolución.
- **Automatización:** FULL/PARTIAL/NONE; no es equivalente a correcto/incorrecto.
- **Técnica:** ERROR/RETRYING/SUCCESS, salud del canal, lastHeartbeatAt, frescura.
- **Calidad:** correctas/incorrectas sobre evaluadas; mostrar cobertura de evaluación.

No se deben presentar datos sin fecha como si fueran del último mes ni asumir cero cuando falta permiso, se interrumpió la integración o no existen datos.

## Próximo módulo analítico

Para comparaciones arbitrarias de periodo, tasas calculadas y drill-down automático desde un KPI al histórico filtrado, desarrollar un widget específico después de medir las limitaciones reales del dashboard nativo. El dato fuente seguirá siendo Twenty y su API.
