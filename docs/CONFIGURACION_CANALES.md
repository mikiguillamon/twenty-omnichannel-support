# Configurar canales por workspace

Un Canal es un buzón, número, bot o cuenta concreta, con su propio `code`, tipo, proveedor e identificador externo. Un workspace puede disponer de varios Canales de email, WhatsApp, Instagram y Telegram.

## Preparación

1. Abrir **Atención al cliente > Canales** en Twenty.
2. Crear una instancia con nombre visible, código único (`code`), `channelType` (`EMAIL`, `WHATSAPP`, `INSTAGRAM` o `TELEGRAM`), `provider` e `externalIdentifier`. Evitar tokens y contraseñas en estos campos.
3. Dejar el Canal inicialmente `DISABLED`. Configurar la conexión del proveedor y el workflow de n8n por separado.
4. Crear una credencial Twenty específica del workspace y probar lecturas/escrituras con el nodo Twenty compatible con objetos personalizados.
5. Desde **Canales → Gestión de consultas**, elegir una política de agrupación. Guardarla en el Canal, donde n8n podrá leerla mediante el nodo Twenty CRM. Verificar que el workflow encuentra el Canal por `code` y comprueba `status=ACTIVE` antes de responder. Comprobar también el estado inmediatamente antes de enviar.
6. Tras las pruebas, activar el Canal desde la interfaz. Pausarlo o desactivarlo para bloquear nuevos envíos automáticos mediante la lógica configurada en n8n.

## Estado operativo y salud técnica

`status` expresa si el Canal puede operar: `ACTIVE`, `PAUSED` o `DISABLED`. `health` expresa el resultado observado de las comprobaciones: `UNKNOWN`, `HEALTHY`, `WARNING` o `CRITICAL`.

n8n o el monitor externo deben actualizar `lastEventAt` tras eventos reales y `lastHeartbeatAt` tras comprobaciones realizadas. `staleAfterMinutes` solo tiene efecto si se implementa la correspondiente regla. No marcar `HEALTHY` por el mero hecho de activar un Canal.

Cambiar el estado en Twenty no crea conexiones ni desactiva por sí mismo los triggers del proveedor. Tampoco cancela los workflows que ya estén en ejecución.

## Integración y supervisión

En cada Consulta, mantener `channel` (`EMAIL`, `WHATSAPP`, `INSTAGRAM` o `TELEGRAM`) y `channelInstanceId` (relación al Canal concreto) coherentes. Conservar histórico cuando se pause o desactive un Canal. Los recuentos acumulados pueden incluir casos de Canales ya desactivados.

Consultar [Integración con n8n](INTEGRACION_N8N.md) y [Checklist](CHECKLIST_PILOTO.md) antes de trabajar con datos reales.

## Políticas de conversación

El Canal ofrece modos distintos para email y chats, ventanas de continuidad/reapertura, opción de clasificación semántica en n8n y tratamiento de casos ambiguos. Las políticas no llaman a ninguna IA desde Twenty ni cambian n8n por sí mismas. Tras actualizar, abrir y guardar las reglas de los Canales existentes. Las reglas del Canal solo se aplican si n8n las lee y las incorpora a su decisión. Consulta [POLITICAS_CONVERSACION.md](POLITICAS_CONVERSACION.md).
