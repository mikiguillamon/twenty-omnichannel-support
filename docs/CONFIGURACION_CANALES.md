# Configurar canales por workspace

Un Canal es un buzón o número concreto, con su propio `code`, tipo, proveedor e identificador externo. Un workspace puede disponer de varios Canales de email y WhatsApp.

## Preparación

1. Abrir **Atención al cliente > Canales** en Twenty.
2. Crear una instancia con nombre visible, código único (`code`), `channelType` (`EMAIL` o `WHATSAPP`), `provider` e `externalIdentifier`. Evitar tokens y contraseñas en estos campos.
3. Dejar el Canal inicialmente `DISABLED`. Configurar la conexión del proveedor y el workflow de n8n por separado.
4. Crear una credencial Twenty específica del workspace y probar lecturas/escrituras con el nodo Twenty compatible con objetos personalizados.
5. Verificar que el workflow encuentra el Canal por `code` y comprueba `status=ACTIVE` antes de responder. Comprobar también el estado inmediatamente antes de enviar.
6. Tras las pruebas, activar el Canal desde la interfaz. Pausarlo o desactivarlo para bloquear nuevos envíos automáticos mediante la lógica configurada en n8n.

## Estado operativo y salud técnica

`status` expresa si el Canal puede operar: `ACTIVE`, `PAUSED` o `DISABLED`. `health` expresa el resultado observado de las comprobaciones: `UNKNOWN`, `HEALTHY`, `WARNING` o `CRITICAL`.

n8n o el monitor externo deben actualizar `lastEventAt` tras eventos reales y `lastHeartbeatAt` tras comprobaciones realizadas. `staleAfterMinutes` solo tiene efecto si se implementa la correspondiente regla. No marcar `HEALTHY` por el mero hecho de activar un Canal.

Cambiar el estado en Twenty no crea conexiones ni desactiva por sí mismo los triggers del proveedor. Tampoco cancela los workflows que ya estén en ejecución.

## Integración y supervisión

En cada Consulta, mantener `channel` (EMAIL/WHATSAPP) y `channelInstanceId` (relación al Canal concreto) coherentes. Conservar histórico cuando se pause o desactive un Canal. Los recuentos acumulados pueden incluir casos de Canales ya desactivados.

Consultar [Integración con n8n](INTEGRACION_N8N.md) y [Checklist](CHECKLIST_PILOTO.md) antes de trabajar con datos reales.
