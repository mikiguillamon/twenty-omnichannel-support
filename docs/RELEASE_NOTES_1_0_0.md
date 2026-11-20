# Omnichannel Support 1.0.0

Primera versión estable de Omnichannel Support para Twenty CRM 2.50.

## Cambios principales

- Centro administrativo integrado en **Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel**, con acceso a dashboards, FAQs, canales, políticas y objetos nativos. La ruta queda protegida por el permiso `APPLICATIONS` de Twenty.
- Se retiran las 11 entradas de navegación que creaban la carpeta técnica Omnichannel en el menú principal. Los miembros siguen usando los accesos operativos independientes del workspace, bajo sus permisos de Twenty.
- Editor de dashboards con reordenación arrastrando la cabecera, redimensionamiento horizontal y vertical desde la esquina, y controles compactos de configuración y eliminación. Conserva los identificadores de los dashboards y widgets anteriores.
- Nuevo almacenamiento `supportDashboards` para permisos de lectura y escritura independientes de `supportSettings`. Los administradores pueden ejecutar la migración explícita y repetible de registros antiguos sin borrarlos.
- Mejoras visuales de las pantallas de canales y sus políticas; cambios de estado sin recargar toda la vista.
- Mantiene las funcionalidades y contratos existentes de FAQs, ingestión omnicanal y la API de búsqueda.

## Actualización desde versiones beta: paso obligatorio

Twenty 2.50 elimina en cascada los enlaces que permanezcan dentro de una carpeta de navegación retirada, **aunque hayan sido creados por el workspace o por un usuario**. Por seguridad, **no actualices directamente desde una versión anterior a beta.27** sin comprobar la navegación.

1. Actualiza primero a `0.3.0-beta.27` (publicada en el Marketplace).
2. Con un usuario Admin, abre **Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel → Datos y ajustes → Preparar el menú para Omnichannel 1.0**.
3. Ejecuta **Inspeccionar menú** y **Proteger accesos compartidos** cuando se detecten enlaces creados por el workspace. Los enlaces se trasladan a la raíz sin cambiar identificador ni destino.
4. Revisa los accesos **personales** dentro de la carpeta para cada usuario. La herramienta no los mueve automáticamente.
5. Crea los accesos operativos independientes que desees mostrar en el menú principal. Comprueba que no sigan dependiendo de la carpeta técnica.
6. Realiza backup de datos y menú. Verifica en un entorno de prueba los roles Admin/Member, la migración de dashboards y las integraciones.
7. Actualiza a `1.0.0`. La carpeta técnica anterior desaparecerá y la administración quedará en Ajustes.

**No desinstales la aplicación para actualizar.** Se preservan los objetos, datos, endpoints y UUID de Twenty.

La instalación requiere Twenty `>=2.50.0 <2.51.0`. Comprueba la versión del core antes de actualizar.

Más información: [Instalación](INSTALACION.md), [Dashboards](DASHBOARD.md), [API Reference](API_REFERENCE.md), [Contrato de release](RELEASE_1_0_0.md).
