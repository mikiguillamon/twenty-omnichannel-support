# Seguridad, privacidad y comercialización

Esta app almacena contenido de emails, WhatsApp y posibles datos personales en registros de Twenty. En un uso real dentro de España/UE, preparar una base jurídica, información al interesado, controles de acceso, acuerdo de tratamiento cuando corresponda y política de conservación/supresión conforme al RGPD.

- **Aislamiento:** cada workspace del CRM tiene usuarios, datos y tokens propios. No compartir claves ni usar una sola API key para todos los clientes.
- **Least privilege:** las funciones y los componentes nunca deben usar una clave global del servidor; el visor de conversación utiliza la sesión/permiso del usuario que lo abre. Revisar la visibilidad de contenido sensible por roles antes de invitar a clientes.
- **Secreto:** `supportSettings` es solo para valores no secretos; tokens OAuth, WhatsApp, SMTP y API keys deben almacenarse en los mecanismos seguros de cada proveedor o de Twenty.
- **Logs:** registrar errores despersonalizados sin cuerpos de mensajes, contraseñas ni claves.
- **Retención:** definir por contrato cuánto tiempo conservar mensajes, borradores, evaluaciones y auditorías. La app piloto no aplica borrado automático.
- **Conformidad:** no se considera un producto auditado, certificado o listo para terceros hasta probar permisos, webhooks, retención, actualización y borrado.
- **Licencia:** la versión piloto permanece UNLICENSED y privada. Antes del Marketplace, decidir expresamente si se comercializará como software propietario, licencia de código abierto o servicio administrado.
