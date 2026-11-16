# Resumen y dashboards de Omnichannel

Omnichannel incluye la página **Resumen**, con indicadores de conversaciones registradas, atención humana pendiente, errores técnicos y evaluaciones incorrectas. Cada tarjeta obtiene su contador de manera independiente mediante la API REST de Twenty, cuyo resultado incluye `totalCount` a nivel raíz. Un error puntual no debe ocultar las demás métricas ni mostrarse como cero.

El botón **Personalizar indicadores** permite activar o desactivar cada contador para el workspace actual. La selección se guarda en `supportSettings` con la clave `omnichannel.dashboard.visibleKpis`. No guarda tokens ni secretos.

La sección de canales activos muestra la configuración de cada Canal; `ACTIVE` no equivale a una comprobación real de la salud del proveedor.

## Dashboard gráfico por workspace

Los dashboards nativos de Twenty son la solución prevista para crear las gráficas, filtros temporales, tablas, agrupaciones y métricas que prefiera cada workspace. No duplicamos el editor de dashboards en una interfaz paralela de la app.

Desde **Tableros / Dashboards** del workspace, crea un panel y añade widgets sobre las fuentes `supportCases`, `supportMessages`, `supportChannels` y `supportEvaluations`. Algunas ideas: volumen por canal/estado/categoría/idioma; conversaciones pendientes; seguimiento programado; evolución por fecha; automatización; resoluciones; evaluaciones incorrectas.

Los periodos, filtros, agrupaciones y tipos de gráfico disponibles dependen de la versión del editor de Twenty. Valida la compatibilidad de cada widget antes de distribuirlo a otros workspaces.

## Errores

Si se muestra `—`, revisa los permisos del usuario y la petición REST concreta. El aviso `No Listener: tabs:outgoing.message.ready` que puede aparecer en el navegador no demuestra por sí solo que la API de Twenty esté fallando; revisa el contexto de la extensión o componente que emite el evento.

Los registros históricos incluyen también los canales posteriormente desactivados. Resultado operativo, ejecución técnica y evaluación humana son medidas independientes.


## Referencia REST de indicadores

La página consulta `GET /rest/supportCases` para el total y con filtros `status[eq]:"HUMAN_REQUIRED"` o `technicalStatus[eq]:"ERROR"`. El indicador de evaluaciones incorrectas utiliza `GET /rest/supportEvaluations` con `verdict[eq]:"INCORRECT"`. En cada respuesta, el contador es `totalCount` a nivel raíz.

La visibilidad de las tarjetas se guarda con `supportSettings.key=omnichannel.dashboard.visibleKpis`. El `valueText` es un array JSON con `total`, `pendingHuman`, `technicalError` e `incorrect`. Las claves disponibles para la API de los demás objetos están documentadas en [API_REFERENCE.md](API_REFERENCE.md).
