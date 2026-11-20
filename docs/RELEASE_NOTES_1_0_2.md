# Omnichannel Support 1.0.2

Actualización de mantenimiento para Twenty CRM 2.50.

- Los reintentos de ingestión pueden completar un mensaje cuando la primera petición guardó su caso de revisión y falló al guardar el mensaje.
- El historial y el destinatario se reinician al cambiar de conversación. Las respuestas de WhatsApp esperan a resolver los alias cuando los necesitan.
- El buscador de FAQs procesa preguntas que antes podían provocar un error. El editor de alcance habilita los cambios después de cargar el registro.
- La lista de dashboards incluye todas las páginas de configuraciones y respeta los archivados. Los widgets de FAQs recuperan correctamente la categoría.
- El gestor de accesos compartidos reconoce los enlaces del workspace. Publicar, renombrar o retirar un acceso requiere el permiso de diseños (`LAYOUTS`) en Twenty.

Para actualizar desde una beta con la carpeta Omnichannel antigua, prepara primero los enlaces compartidos y personales siguiendo la [guía de instalación](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INSTALACION.md#preparar-la-actualización-con-la-beta-27).
