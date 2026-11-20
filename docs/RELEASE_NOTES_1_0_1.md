# Omnichannel Support 1.0.1

Versión estable para Twenty CRM 2.50. Mantiene todos los objetos de soporte, sus datos, identificadores, FAQs y contratos de API de la versión 1.0.0.

## Cambios

- Administración con pestañas horizontales y ancho adaptable al contenedor de Ajustes.
- Gestor de accesos compartidos a dashboards en el menú principal de Twenty: publicar, renombrar y retirar.
- Protección explícita de enlaces personales, enlaces creados manualmente y elementos de otras aplicaciones.
- Validación de rutas internas y protección contra enlaces duplicados.
- Pruebas automatizadas de navegación y conservación de los datos.

## Uso del gestor

Como administrador, abre **Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel → Dashboards**.
Abre el dashboard en una página operativa para copiar el enlace interno `/page/...` con `omniDashboard`; pégalo en **Accesos publicados por Omnichannel**, elige un nombre y pulsa **Publicar acceso**.
Solo los accesos creados por el gestor se pueden renombrar o retirar desde ese panel. Se guarda una marca de procedencia en el enlace para evitar intervenir sobre accesos manuales.
Los roles de Twenty determinan los permisos efectivos de lectura del dashboard y de sus fuentes.

## Compatibilidad y precauciones

- Twenty `>=2.50.0 <2.51.0`; SDK de Twenty 2.50.
- Actualización directa desde Omnichannel Support 1.0.0 sin migración del esquema ni reinstalación.
- Twenty controla el ancho exterior del contenedor de Ajustes; la app usa el ancho disponible pero no modifica esa parte del core.
- Los accesos publicados por el gestor se crean en la raíz del workspace y no son propiedad del manifiesto de Omnichannel.
- Antes de desplegar en todos los workspaces, comprueba con usuarios Admin y Member la actualización de la barra lateral, la apertura del enlace y los permisos.

No desinstales Omnichannel para actualizar.