# Supervisión y dashboards de Omnichannel Support

## Resumen incluido

La app incluye una página de resumen con cuatro indicadores acumulados: Consultas registradas, pendientes de intervención humana, errores técnicos y evaluaciones incorrectas. También facilita acceso a los casos pendientes y los errores. Los indicadores se obtienen del workspace actual y necesitan permisos suficientes; si falla la consulta, la interfaz debe mostrar ausencia de datos y no ceros ficticios.

La página de Resumen lista los Canales activos. Su estado operativo (`ACTIVE`) no demuestra que el proveedor funcione correctamente, algo que debe reflejarse en `health`.

## Dashboard de análisis en Twenty

Cuando el editor de dashboards de la versión instalada lo permita, utilizar widgets separados para:

| Área | Fuente | Medición |
|---|---|---|
| Volumen | `supportCases` | Casos por fecha y canal |
| Atención | `supportCases` | Estados y tiempos de resolución |
| Automatización | `supportCases` | `automation` FULL/PARTIAL/NONE |
| Resultado | `supportCases` | `resolution` SOLVED/UNSOLVED/PENDING |
| Técnica | `supportCases`, `supportChannels` | Errores, reintentos y salud |
| Calidad | `supportEvaluations` | Veredictos y cobertura de revisión |

Configurar los periodos y filtros de cada widget. Confirmar que la versión de Twenty admite las relaciones y agrupaciones deseadas; no dar por hecho un filtro global aplicable automáticamente a todos los widgets.

## Reglas de interpretación

Una ejecución técnica correcta (`technicalStatus=SUCCESS`) no demuestra una Consulta resuelta (`resolution=SOLVED`) ni una evaluación humana positiva (`verdict=CORRECT`).

Para métricas de calidad, publicar tanto los resultados de las evaluaciones como su cobertura: número de elementos evaluados dividido entre elementos elegibles. Los totales históricos incluyen Consultas de Canales que más tarde se hayan desactivado.

Los comparativos por periodo y los ratios personalizados pueden requerir widgets adicionales. Verificar primero las capacidades del editor y la API de la versión real de Twenty.
