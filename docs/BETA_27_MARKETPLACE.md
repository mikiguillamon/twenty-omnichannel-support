# Omnichannel Support 0.3.0-beta.27 — transición hacia 1.0.0

Esta versión se publica en npm y en el Marketplace de Twenty como una actualización de transición **no destructiva**. Permite instalar el nuevo editor visual de dashboards, el centro administrativo y el almacenamiento independiente de dashboards antes de retirar el menú técnico antiguo.

## Qué incluye

- Centro administrativo en Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel.
- Mejoras del editor de dashboards con organización por arrastre y redimensionamiento de ancho y alto.
- Almacenamiento separado de dashboards en `supportDashboards` y opción **Migrar dashboards antiguos**. Conserva los registros originales.
- Nueva herramienta en **Datos y ajustes → Preparar el menú para Omnichannel 1.0** para inspeccionar los accesos compartidos del workspace dentro de la carpeta Omnichannel y moverlos a la raíz antes de su eliminación.
- Las FAQs, conversaciones, canales, categorías, identidades, API de ingestión y workflows de n8n mantienen su contrato.

## Importante antes de 1.0.0

**La beta.27 mantiene deliberadamente la carpeta Omnichannel y sus entradas instaladas.**

En Twenty 2.50, borrar una carpeta de navegación elimina en cascada los accesos que todavía cuelguen de ella, incluso si los creó un usuario. Por eso esta versión permite trasladar primero los accesos compartidos al menú principal, sin borrar enlaces ni alterar sus destinos. Los enlaces personales se revisan por sus propietarios.

En el centro administrativo, ejecuta **Inspeccionar menú** y **Proteger accesos compartidos** cuando sea necesario. Después, revisa los enlaces personales que pudieran estar anidados. Los accesos operativos deben ser entradas creadas por el workspace y no simples movimientos de las entradas propiedad del plugin.

La futura 1.0.0 eliminará el menú técnico antiguo y mantendrá únicamente el centro de administración protegido mediante el permiso nativo `APPLICATIONS` de Twenty.

No es necesario actualizar el core ni desinstalar la aplicación para esta beta. Consulta [Instalación](INSTALACION.md) y [Plan estable](RELEASE_1_0_0.md).
