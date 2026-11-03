# Configurar canales por cliente en Twenty

En **Atención al cliente → Canales** puedes crear las instancias que realmente utiliza este workspace. Un canal es un buzón de correo o número de WhatsApp, no una sección fija del menú.

1. Crea un canal indicando **Nombre**, **Código único**, **Tipo**, **Proveedor** e **Identificador externo**. No introduzcas contraseñas ni tokens.
2. Se guardará **Desactivado**. Este estado evita confundir una configuración recién creada con una integración lista.
3. Prepara y prueba de forma independiente la conexión en n8n. Utiliza una API key exclusiva del workspace para consultar `supportChannels` y registrar `supportCases` y `supportMessages`.
4. Cuando esté probado, marca la casilla de confirmación y pulsa **Marcar activo**. Puedes pausarlo o desactivarlo sin eliminar mensajes ni conversaciones.
5. En **Consultas** utiliza las vistas guardadas **Email**, **WhatsApp**, **Pendientes de agente** y **Errores técnicos**. El menú lateral ya no muestra atajos fijos para cada tipo de canal.
6. En **Resumen** verás solo los canales marcados como activos. Los contadores acumulados incluyen datos históricos, aunque un canal ya esté desactivado.

## Contrato de la integración

La interfaz **no configura Gmail, Evolution API, Microsoft 365 ni n8n**. Solo escribe el registro de Canal en Twenty. Para que un estado `PAUSED` o `DISABLED` detenga respuestas, cada workflow tiene que comprobar `status === ACTIVE` antes de enviar o procesar. El cambio de estado no cancela ejecuciones ya iniciadas.

Usa `code` como identificador estable, una clave externa distinta por conversación y otra por mensaje, y la relación `channelInstanceId` de cada Consulta. Confirma el esquema en el **API Playground** de Twenty antes de enviar peticiones desde n8n. No reutilices claves de API entre workspaces.

Los botones de activación están protegidos por una confirmación visual, pero no hacen una verificación técnica real del proveedor. `health` y las marcas de tiempo deben proceder de eventos o comprobaciones reales, nunca deducirse de `status`.

## Actualizar desde la versión anterior

Publica una versión nueva desde GitHub Actions. En cada workspace abre **Settings → Applications → Omnichannel Support** e instala la actualización sin desinstalar la anterior. Comprueba que las consultas y mensajes previos siguen accesibles y que las vistas Email/WhatsApp siguen dentro de Consultas. No hay migración ni borrado de registros.
