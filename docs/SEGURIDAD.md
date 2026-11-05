# Seguridad y privacidad

Omnichannel Support almacena conversaciones y datos personales en los registros de Twenty. Cada organización que lo despliegue debe definir sus reglas de acceso, conservación y supresión antes de tratar comunicaciones reales.

## Separación por workspace

Crear credenciales diferentes para cada workspace de Twenty y conceder solo los permisos necesarios para Personas, Consultas, Mensajes, identidades externas, alias, FAQs, Canales y Evaluaciones. No compartir tokens entre organizaciones ni utilizar una clave global de administración para el visor de conversaciones. Comprobar los permisos desde un usuario de atención con acceso limitado.

## Credenciales

Guardar las API keys de Twenty y los secretos de Gmail, Microsoft 365, WhatsApp o cualquier proveedor en un sistema adecuado de credenciales, como el gestor de n8n. `supportSettings` está destinado a parámetros no secretos. No introducir tokens, contraseñas, claves privadas ni cuerpos de mensajes en `errorSummary`.

## Webhooks y contenido

Validar el origen de cada evento antes de crear registros. Distinguir mensajes entrantes, salidas propias y acuses para evitar bucles. Normalizar direcciones e identificadores según el proveedor. Resolver PN JID/LID con evidencia fiable y no fusionar automáticamente identidades en conflicto. Tratar cuerpo HTML y adjuntos según una política explícita y utilizar los controles de acceso del proveedor donde se guarden archivos. Revisar quién puede acceder a los datos de ejecución retenidos por n8n.

## Conservación y derechos

Definir base jurídica, información a interesados, acuerdos de tratamiento cuando correspondan y plazos para Mensajes, borradores, identificadores externos, Evaluaciones, registros de auditoría y adjuntos. Documentar procedimientos de acceso, rectificación y supresión conforme a la normativa aplicable. La app no aplica automáticamente una política de borrado o anonimización.

## Cambios y despliegues

Antes de actualizar Twenty o la app, comprobar compatibilidad de esquema, permisos, migraciones y API de n8n en un workspace de pruebas. Mantener identificadores universales de la app y evitar desinstalaciones que pongan en riesgo datos. Una instalación privada y una distribuida por npm pueden tener implicaciones de identidad; probar su transición en entorno aislado.

## Licencia

El proyecto se distribuye bajo licencia MIT. El archivo `LICENSE` contiene los términos aplicables y debe conservarse cuando corresponda. La licencia de software no sustituye obligaciones contractuales, de privacidad o seguridad del servicio.
