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

## Eliminar un canal sin borrar las conversaciones

1. Detener primero las automatizaciones externas de n8n que trabajan con ese canal, incluidas las ejecuciones pendientes. Desactivar un canal en Twenty **no detiene n8n**.
2. Guardar una copia del historial si hace falta, y desactivar el canal en **Atención al cliente → Canales**.
3. Pulsar **Eliminar canal**, confirmar que la automatización externa está detenida y escribir el código único del canal.
4. Pulsar **Eliminar definitivamente**. La app comprueba otra vez que el canal mantiene su ID, su código y el estado `DISABLED`.

Solo se destruye el registro del Canal. Las Consultas, Mensajes, Personas, Identidades externas y Alias permanecen intactos. Las relaciones de las Consultas e Identidades hacia el Canal usan `SET_NULL`, por lo que dejan de apuntar a ese Canal. Los filtros que dependan de la instancia dejarán de encontrar ese historial, aunque los registros sigan existiendo.

La operación utiliza la API REST de Twenty con `soft_delete=false`, para liberar también el código único. El usuario debe tener permiso **Destroy** sobre Canales. El rol técnico de la app no recibe permisos nuevos de eliminación. En caso de rechazo de la API, revisar permisos y dependencias sin borrar manualmente los registros relacionados.

## Integración y supervisión

En cada Consulta, mantener `channel` (`EMAIL`, `WHATSAPP`, `INSTAGRAM` o `TELEGRAM`) y `channelInstanceId` (relación al Canal concreto) coherentes. Conservar histórico cuando se pause o desactive un Canal. Los recuentos acumulados pueden incluir casos de Canales ya desactivados.

Consultar [Integración con n8n](INTEGRACION_N8N.md) y [Checklist](CHECKLIST_PILOTO.md) antes de trabajar con datos reales.

## Políticas de conversación

El Canal ofrece modos distintos para email y chats, ventanas de continuidad/reapertura, opción de clasificación semántica en n8n y tratamiento de casos ambiguos. Las políticas no llaman a ninguna IA desde Twenty ni cambian n8n por sí mismas. Tras actualizar, abrir y guardar las reglas de los Canales existentes. Las reglas del Canal solo se aplican si n8n las lee y las incorpora a su decisión. Consulta [POLITICAS_CONVERSACION.md](POLITICAS_CONVERSACION.md).
