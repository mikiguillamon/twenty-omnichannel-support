# Instalar y actualizar Omnichannel Support

La aplicación funciona por workspace dentro de Twenty. Cada instalación mantiene sus propios canales, categorías, conversaciones, identidades y ajustes. La rama de preparación de la 1.0.0 se valida con Twenty 2.50; hasta publicar la versión estable, el Marketplace puede seguir mostrando la última beta.

## Actualización desde la beta al menú sin carpeta técnica

**Antes de actualizar** realiza una copia de seguridad de la navegación del workspace y de los dashboards. En Twenty, entra en **Editar menú** y comprueba los accesos que quieres conservar fuera de Omnichannel. Una entrada que pertenezca a la aplicación —aunque la hayas arrastrado a la raíz del menú— puede eliminarse cuando el nuevo manifiesto retire sus antiguas entradas. Recréala como un **enlace independiente del workspace** antes del cambio.

Los accesos creados de esta manera quedan fuera de la propiedad del paquete Omnichannel y deben mantenerse entre versiones. Para dashboards, copia el enlace directo desde la página operativa del dashboard (no desde Ajustes); para FAQs puedes utilizar el enlace al layout visual o la vista nativa correspondiente.

Tras la actualización, comprueba por separado con dos usuarios reales:

- **Admin con permiso de aplicaciones:** ve el centro administrativo completo en Ajustes y puede navegar a canales, políticas, FAQs, dashboards, objetos y ajustes.
- **Member sin ese permiso:** no ve ninguna carpeta Omnichannel en el menú principal ni las páginas administrativas de Ajustes; solo los accesos del workspace para los que tenga permisos en Twenty.

Nunca desinstales y reinstales la app para migrar la navegación. En un entorno de pruebas, revisa antes un diff de metadatos con `twenty app plan`: deben desaparecer únicamente las antiguas entradas de navegación de la app, no los objetos ni sus datos.

## Requisitos

Necesitas una instancia de Twenty compatible, permisos para instalar aplicaciones y una versión distribuida desde el Marketplace o por el mecanismo privado correspondiente. Para registrar eventos, prepara una API key del workspace que vaya a recibirlos.

El esquema se compone de los objetos `supportCases`, `supportMessages`, `supportChannels`, `supportExternalIdentities`, `supportIdentityAliases`, `supportCategories`, `supportFaqs`, `supportEvaluations` y `supportSettings`. Personas y Tareas son objetos nativos de Twenty que la app puede relacionar.

## Instalar desde Twenty

1. Abre el Marketplace del workspace y localiza Omnichannel Support. Comprueba nombre, versión y compatibilidad.
2. Instala la app y espera a que Twenty aplique su esquema. Como administrador del workspace con permiso para administrar aplicaciones, abre **Ajustes > Aplicaciones > Omnichannel Support > Administración Omnichannel**. Todas las herramientas técnicas están en ese centro; la app no añade una carpeta al menú principal.
3. Abre una Persona de prueba para comprobar la pestaña Omnichannel, que muestra Conversaciones e identidades relacionadas.
4. Comprueba que la página Resumen carga los cuatro contadores REST y permite elegir cuáles se muestran.
5. Crea una Categoría con `code` estable si vas a clasificar conversaciones. Añade después un Canal desactivado, seleccionando Email, WhatsApp, Instagram, Telegram o PHONE.
6. Configura la política de conversación del Canal. Para correo puedes usar agrupación por hilo. Para chats, revisa los modos de actividad y los casos ambiguos.

La app no instala ni configura Gmail, Evolution API, Telegram, Instagram o una centralita. El transporte se gestiona desde el proveedor y, normalmente, con n8n.

## Conectar el endpoint autenticado

Prepara un HTTP Request desde n8n al endpoint del workspace:

```http
POST https://TWENTY_HOST/s/omnichannel/v1/ingest
Authorization: Bearer TOKEN_DEL_WORKSPACE
Content-Type: application/json
```

Confirma la URL efectiva de la función en tu Twenty. La definición interna es `/omnichannel/v1/ingest`, y el handler exige autenticación.

Envía `channelCode`, los datos de `contact` y de `message`. Para añadir o actualizar estado, seguimiento, categoría o resumen al incorporar un mensaje, incluye `conversation`. Consulta [API Reference](API_REFERENCE.md) y [n8n](INTEGRACION_N8N.md).

Antes de activar un Canal, prueba la creación de un mensaje, un reintento con la misma ID estable, un segundo mensaje del mismo asunto y un acuse `message.status`. Comprueba la vinculación correcta a Persona y que el estado no se modifica por un acuse de entrega.

## Actualizar una instalación

1. Haz copia de seguridad de la base de datos y confirma qué versión de la app tiene instalada cada workspace.
2. Revisa [CHANGELOG](../CHANGELOG.md), compatibilidad y campos añadidos. No cambies los identificadores universales de objetos ni campos existentes.
3. Actualiza primero un workspace de prueba con datos representativos. La actualización debe conservar los objetos y sus registros; **no desinstales la app** para actualizarla.
4. Comprueba las opciones nuevas de `status`, `followUp`, el canal `PHONE`, los campos de llamadas, la ficha de Persona y el Resumen.
5. Ejecuta [CHECKLIST_PILOTO.md](CHECKLIST_PILOTO.md) y valida un envío real al endpoint con una credencial de pruebas.
6. Sincroniza el Marketplace cuando sea necesario y actualiza los demás workspaces de forma controlada. La publicación npm y el catálogo de Twenty son procesos distintos.

## Rollback y límites

Volver a un paquete anterior puede dejar campos nuevos que esa versión desconoce. Antes de hacer rollback, revisa compatibilidad y conserva una copia de los datos. No borres manualmente los nuevos campos para ocultar un problema de interfaz.

La función de ingestión no envía mensajes ni genera grabaciones. Las URLs de audio se guardan como enlaces HTTPS que deben estar protegidos. Para diagnóstico y errores de permisos, revisa [Seguridad](SEGURIDAD.md), [Referencia API](API_REFERENCE.md) y [Publicación](PUBLICACION.md).
