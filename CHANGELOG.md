## 1.0.2 — Fiabilidad de ingestión, FAQs y dashboards

- Recupera los casos de revisión cuando un reintento completa la escritura de un mensaje.
- Separa el historial y el destinatario al cambiar de conversación y resuelve los alias de WhatsApp antes de habilitar la respuesta cuando son necesarios.
- Corrige la búsqueda de FAQs y protege sus alcances cuando falla la lectura del registro.
- Pagina los dashboards guardados, corrige los widgets de FAQs y adapta los accesos compartidos a los permisos y la propiedad de navegación de Twenty 2.50.
- Refuerza la cola, la validación y los reintentos del workflow de publicación en npm.

## 1.0.1 — Administración y accesos de dashboards

- Administración de Omnichannel con pestañas horizontales adaptables y mayor aprovechamiento del ancho disponible.
- Gestión de accesos compartidos a dashboards: creación, renombrado y retirada desde Ajustes.
- Protección de enlaces personales, enlaces creados manualmente y navegación de otras aplicaciones; solo se gestionan accesos identificados por Omnichannel.
- Pruebas de regresión de enlaces y operaciones de navegación. Compatible con Twenty 2.50.

## 1.0.0 — Omnichannel con administración separada

- Retira la carpeta técnica y sus enlaces de la navegación del plugin; la administración pasa a **Ajustes → Aplicaciones → Omnichannel Support** bajo los permisos nativos de Twenty.
- Los usuarios trabajan mediante enlaces compartidos creados por el workspace; la API, las FAQs y la base de datos mantienen sus UUID y funcionalidades.
- Consolidación del editor de dashboards con drag & drop y resize, nuevo almacenamiento `supportDashboards` y migración no destructiva.
- **Migración obligatoria:** instalar primero `0.3.0-beta.27` y preparar los enlaces personalizados antes de retirar la carpeta, porque Twenty 2.50 borra en cascada los enlaces anidados.

## 0.3.0-beta.27 — transición segura al centro administrativo

- Incluye el nuevo centro administrativo en Ajustes, edición bidimensional de dashboards, almacenamiento independiente `supportDashboards` y migración de dashboards anteriores conservando el original.
- Incorpora una herramienta que detecta y traslada a la raíz los enlaces compartidos del workspace que aún están dentro de la antigua carpeta Omnichannel.
- **Por seguridad conserva la carpeta y sus 10 accesos internos originales**: Twenty 2.50 eliminaría en cascada enlaces personalizados anidados al retirarla sin preparación previa. La eliminación queda para la 1.0.0.
- Mantiene la API de ingestión, FAQs y sus datos existentes; incorpora pruebas de regresión.

## Unreleased — camino a Omnichannel Support 1.0.0

- Mueve la administración de la aplicación a **Ajustes → Aplicaciones → Omnichannel Support → Administración Omnichannel**, bajo el permiso nativo `APPLICATIONS` de Twenty 2.50.
- Retira las 11 entradas de navegación propiedad de la aplicación, incluida la antigua carpeta lateral Omnichannel. Los enlaces creados independientemente en el workspace no forman parte del manifiesto de la app y permanecen administrados por Twenty. **Antes de actualizar**, hay que convertir en enlaces propios del workspace las entradas de la app que se hayan movido fuera de la carpeta.
- Reúne dashboards, FAQs, configuración de canales, políticas de conversación y enlaces a todos los objetos nativos en un centro administrativo reutilizando los componentes existentes.
- Sustituye las flechas y controles +/- del editor de dashboards por el arrastre desde la cabecera y el redimensionamiento mediante un tirador en la esquina. Mantiene configuración, IDs, período y enlaces de los dashboards existentes.
- Unifica estilos de canales y políticas con las nuevas FAQs y dashboards; los cambios de estado de canal actualizan la tarjeta sin recargar todo el listado.
- Separa el almacenamiento operativo de dashboards en el objeto `supportDashboards`, con permisos propios. Incluye migración explícita e idempotente desde `supportSettings` sin borrar los registros antiguos, y pruebas de no regresión.
- Amplía pruebas de compatibilidad y documentación de instalación y migración. **Aún no es una release publicada**: faltan las pruebas de permisos y actualización de un workspace real.


## 0.3.0-beta.26 — FAQs instantáneas y editor visual de dashboards

- Actualiza el interruptor Activa de las FAQs en la tarjeta afectada sin recargar el listado. Bloquea clics repetidos y recupera el estado anterior si la API falla.
- Mejora las visualizaciones de dashboards: ejes y fechas más legibles, barras e histogramas, distribuciones donut con porcentajes, tablas y estados de carga/vacío/error.
- Permite reordenar los widgets con arrastre y soltado, flechas accesibles y opciones para ampliar o reducir el ancho.
- Añade enlaces internos directos por dashboard para crear accesos en la barra lateral principal de Twenty 2.50. El usuario decide su ubicación mediante las herramientas nativas de Twenty.
- Conserva el esquema v2 de dashboards, los UUID y la API del plugin. Compatible con los cambios publicados en las betas 24 y 25.


## 0.3.0-beta.25 — Dashboards configurables

- Nuevo editor de dashboards Omnichannel por workspace con KPIs, gráficos, filtros, períodos y layouts persistidos en Twenty.
- Métricas de conversaciones, mensajes, evaluaciones, canales y FAQs, con exportación/importación de configuraciones.
- Conserva íntegramente los cambios en FAQs publicados en beta.24; no altera sus objetos ni APIs.
- Paginación y límite explícito de datos para evitar presentar agregados parciales como completos.

## 0.3.0-beta.24 — Interacción de FAQs: toggle, iconos y editor lateral

- Sustituye el checkbox Publicada por un toggle accesible «Activa» (PUBLISHED ↔ DRAFT), sin alterar el estado persistido ni el filtro de publicación del bot.
- Sustituye Editar y Archivar por botones con iconos SVG accesibles, e incluye Restaurar para FAQs archivadas.
- Traslada el formulario de creación y edición al panel lateral nativo de Twenty 2.50 (`SidePanelPages.ViewFrontComponent`), evitando modales personalizados no soportados por el SDK.
- Mantiene categorías, opciones avanzadas, permisos de usuario, confirmación de archivo y API de FAQs; incorpora pruebas de regresión.
- No modifica los objetos, UUID ni la navegación de Omnichannel.


## 0.3.0-beta.23 — Corrección de actualización del gestor visual de FAQs

- Corrige el rechazo de Twenty 2.50 al actualizar la navegación: el identificador ya instalado de «FAQs» conserva su tipo OBJECT y abre la tabla nativa, ahora llamada «FAQs (tabla)».
- Registra «FAQs» visual como una entrada PAGE_LAYOUT nueva, con un UUID propio. No modifica el tipo de ninguna entrada existente.
- Elimina la definición provisional de la entrada de tabla introducida en beta.22 (que no llegó a instalarse en los workspaces afectados) y añade una prueba de regresión del tipo y del UUID estable.
- Mantiene todos los objetos, relaciones, FAQs existentes y endpoints sin cambios. No requiere desinstalación ni migraciones de datos.


## 0.3.0-beta.22 — Gestor visual de FAQs

- Añade un gestor de FAQs dentro de Omnichannel con tarjetas agrupadas por categoría, búsqueda textual, filtros de estado, idioma y alcance, y listado paginado visualmente.
- Permite crear y editar preguntas y respuestas desde la misma pantalla, con opciones avanzadas para variantes, etiquetas y referencias.
- Permite publicar, pasar a borrador, archivar y restaurar sin eliminar datos. Conserva también el acceso a las vistas nativas de Twenty.
- Respeta el usuario y los permisos del workspace mediante RestApiClient sin credenciales de aplicación, y usa paginación REST por cursor para cargar registros completos sin ocultar resultados silenciosamente.
- Mantiene los objetos y sus identificadores universales; no modifica el endpoint de búsqueda de bots ni los flujos de n8n.


## 0.3.0-beta.21 — Filtro REST validado en EGORA

- Corrige el error 502 persistente del buscador: Twenty 2.50 rechaza también `containsIlike` en el parser REST para `scopeTags` aunque su tipo sea ARRAY.
- La API filtra por estado publicado y coincidencias textuales en origen; Omnichannel comprueba los alcances de cada candidata antes de puntuarla o devolverla, con un límite estricto de 200 candidatas.
- Normaliza también las etiquetas guardadas como nombres legibles (`General`, `Campus Hivern`) sin alterar registros ni relajar la exclusión de FAQs sin etiqueta o con otros alcances.
- Añade pruebas de regresión para el filtrado real de Twenty 2.50 y los nombres de alcance existentes.
- No cambia la estructura de datos, la ruta, el payload ni la autenticación del endpoint.


## 0.3.0-beta.20 — Búsqueda de FAQs compatible con Twenty 2.50

- Corrige el error 502 causado por `scopeTags[containsAny]` sobre campos ARRAY: utiliza el operador `containsIlike` con scopes combinados mediante `or`.
- Conserva términos acentuados y distribuye el presupuesto de búsqueda entre conceptos.
- Corrige la paginación con cursores opacos y evita rechazar exactamente 200 coincidencias.
- Añade pruebas de regresión y documentación de integración.


## 0.3.0-beta.19 — Búsqueda inteligente de FAQs

- Nuevo endpoint de búsqueda de FAQs por lenguaje natural, autenticado mediante la API Bearer habitual de Twenty.
- `scopeTags` como filtro de la petición; incluye `GENERAL` y excluye borradores, FAQs sin alcance y resultados fuera de filtro.
- Recuperación acotada y relevancia determinista multilingüe ES/CA basada en preguntas, variantes y respuestas.
- Documentación y pruebas para integración desde n8n sin nodos Code. No se añade un registro de bots ni secretos adicionales.


## 0.3.0-beta.18 — Creación automática de Categorías y Tipos

- Permite crear automáticamente Categorías y Tipos al recibir códigos nuevos en la API de ingestión, usando el mismo valor para nombre y código.
- Reutiliza entradas existentes y resuelve concurrencia mediante índices únicos, sin generar duplicados ni reactivar registros deshabilitados.
- Evita que los UUID desconocidos creen registros y actualiza las pruebas, la referencia de API y la guía de n8n.


## 0.3.0-beta.17 — Tipos de conversación y alcance de FAQs

- Añade un catálogo configurable de Tipos para conversaciones, separado del de Categorías, con asignación por código o ID desde la API.
- Permite que cada mensaje nuevo actualice asunto, tipo, categoría, estado, etiquetas, responsable y otros metadatos de la conversación sin alterar los campos omitidos.
- Incorpora Alcance multietiqueta en las FAQs, con un editor específico y filtros para bots por alcance General y alcances concretos.
- Conserva las relaciones y los datos de las versiones anteriores, refuerza las validaciones y amplía las pruebas y la documentación de integración.


## 0.3.0-beta.16 — Accesos de respuesta por canal

- Añade **Responder** debajo del historial de conversación para abrir WhatsApp, el correo, Telegram, Instagram o el marcador de llamadas en una aplicación externa cuando hay un destinatario válido.
- Resuelve el destino desde la conversación y la identidad externa vinculada; WhatsApp también reconoce alias PN y evita abrir números a partir de LID o identificadores ambiguos.
- Deshabilita la acción cuando falta información fiable y aclara que abrir el enlace no registra automáticamente el mensaje enviado en Twenty.
- Incorpora pruebas del enrutamiento por canal y la validación de destinatarios. Sin cambios en el esquema ni en la API de ingestión.

- La ingestión admite nombres y apellidos explícitos y completa los campos nativos vacíos de la Persona sin sobrescribir datos existentes.
- Los eventos de llamadas telefónicas pueden llevar grabación HTTPS y transcripción, que se incorporan también al detalle de conversación.
- El historial permite reproducir las grabaciones de llamadas directamente desde el navegador, siempre que la URL sea accesible y el formato compatible.
- Se amplían las pruebas de ingesta, vinculación segura e idempotencia de contactos y llamadas.

# Changelog

## 0.3.0-beta.12 - Conversation metadata, phone calls and workspace overview

- Added conversation states `AUTOMATED`, `INFORMATIONAL` and `WAITING_INTERNAL`, plus follow-up tracking, language, comments, transcription and recording links.
- Extended the authenticated ingestion API so each new message can set or update conversation status and metadata. Delivery notifications remain separate, and retries do not reapply stale conversation changes.
- Added `PHONE` channels, call-level transcriptions and recording URLs. Call transport and audio storage remain external.
- Renamed the customer-support menu to **Omnichannel** and the case object to **Conversaciones** in the interface. REST resource names and existing universal identifiers are unchanged.
- Added an Omnichannel tab and view on native People records to expose related conversations and identities.
- Switched overview counters from the previous GraphQL request to separate REST queries. Visibility of the four built-in KPIs is configurable per workspace; native Twenty dashboards provide additional charts.
- Expanded integration tests and SDK checks. See [API reference](docs/API_REFERENCE.md), [n8n integration](docs/INTEGRACION_N8N.md) and [upgrade checklist](docs/CHECKLIST_PILOTO.md).


## 0.3.0-beta.11 — Channel deletion permission fix

- Grant the application's role `Destroy` for Support Channels only, while keeping conversations and identities protected.
- Surface HTTP and validation failures when Twenty rejects channel removal.
- Preserve the confirmation step, disabled-only restriction and historical messages.


## 0.3.0-beta.9 — Safe channel removal

- Add explicitly confirmed removal for disabled channels, with re-validation before deletion.
- Preserve Cases, Messages and External Identities using existing SET_NULL relations.
- Require the current user’s Twenty Destroy permission; external n8n workflows are not changed.
- Document data retention and installed-app update controls.

## 0.3.0-beta.8 - Marketplace copy and documentation

- Rework the README for Marketplace visitors, with a concise explanation of customer support workflows and working links to the guides.
- Move developer setup, verification and release details to `CONTRIBUTING.md` and the dedicated documentation.
- Set the Marketplace category to Communication and clarify the application's short description.
- Correct outdated references in the n8n integration, channel policies, identity aliasing and installation guides. No CRM objects, fields or workflow behavior change.


## 0.3.0-beta.7 — WhatsApp PN JID / LID handling

- Add `supportIdentityAliases` to associate a WhatsApp phone JID and LID with one logical external identity, scoped to the provider and receiving account.
- Preserve both original chat identifiers and the provider message ID on each Message.
- Add collision-safe alias resolution helpers and regression tests; conflicting identities must be reviewed rather than automatically merged.
- Document resolution using n8n's Twenty CRM node, including single-identifier events, reversed PN/LID order and outbound tracking.
- This update only adds data structures; it does not modify provider integrations or n8n workflows.


## 0.3.0-beta.6 — Per-channel conversation policies (candidate)

- Add Email, WhatsApp, Instagram and Telegram channel types. Configure per-channel routing (thread, individual message, hybrid, session or manual) from the Channel management page.
- Add configurable continuation and reopen windows, optional n8n semantic classification thresholds, ambiguity handling and disabled-by-default auto-close.
- Add `supportExternalIdentities` to identify provider-scoped users and optionally link them to native People, Channels and Cases.
- Preserve existing object and field identifiers; existing channel records keep their data, with policy defaults applied by the UI until explicitly saved.
- Document the native Twenty CRM node integration and update schema checks. The app itself does not call any AI model or modify n8n workflows.


## 0.3.0-beta.5 — MIT license in npm package (candidate)

- Preserve the canonical MIT `LICENSE` in the generated npm distribution using the Twenty CLI packaging lifecycle.
- CI and public release workflow now inspect the actual tarball and fail if `package/LICENSE` is absent or differs from the source file.
- GitHub Actions publication of `0.3.0-beta.4` succeeded with signed npm provenance. No runtime changes to Twenty objects, IDs or workflows.


## 0.3.0-beta.4 — publicada en npm con OIDC y provenance

- Nueva versión prerelease para probar GitHub Release → GitHub Actions → npm Trusted Publishing con OIDC y provenance.
- Sin cambios funcionales: conserva los identificadores universales y el modelo de datos de Twenty.
- Publicación de npm `beta` verificada mediante GitHub Actions; el artefacto de esta versión no incluía el texto `LICENSE`, corregido en beta.5.


## Public MIT licensing — 2026-11-03

- Approved open-source distribution: MIT License and full copyright notice for Just For Fun 360, S.L.
- Set `package.json` to `private: false` and `license: MIT`, preserving version `0.3.0-beta.3` as the first public candidate.
- Updated release preflight tests to require MIT for npm releases.
- Does not automatically publish to npm or modify existing Twenty installations.


## 0.3.0-beta.3 — candidato de distribución (no publicado)

- Preparar nombre público `twenty-omnichannel-support` y metadata de repositorio y soporte; conservar los UUID internos de la app.
- Unificar publicación npm con la guía de Knowledge: GitHub Release (published) → `publish.yml` → npm Trusted Publishing/OIDC y provenance.
- Bloquear la publicación pública mientras `private: true` y licencias/validaciones no estén aprobadas.
- Añadir preflight y pruebas de release, instalaciones inmutables con Yarn y documentación de bootstrap.
- Retirar el antiguo workflow con formulario manual y Environment `npm-publication`. No elimina el Environment de GitHub usado por otros procesos.
- Sin cambios funcionales ni migraciones de datos en Twenty o n8n.


## 0.3.0-beta.2 — Configuración de canales por workspace

- Nueva pantalla de Canales, con creación y cambio de estado dentro de Twenty.
- Nuevas instancias en DISABLED para evitar activaciones accidentales.
- Eliminados los accesos fijos del menú a Email, WhatsApp y vistas técnicas; vistas y registros conservados.
- Resumen con canales activos del workspace; los contadores históricos permanecen sin filtros.
- Guía de configuración integrada y documentación de API/n8n.
- Sin eliminación de objetos ni modificaciones de workflows externos.


## 0.3.0-beta.1 — Piloto privado

- Modelo de siete objetos: FAQs, Categorías, Consultas, Mensajes, Ajustes de soporte, Canales y Evaluaciones.
- Relaciones bidireccionales con Personas y Tareas nativas de Twenty.
- Dimensiones separadas de estado técnico, resultado operativo y evaluación humana.
- Historial de mensajes entrantes/salientes, borrador generado, decisión de respuesta y acuses de envío.
- Página de consulta con visor cronológico de mensajes y tablas de relaciones editables bajo permisos.
- Página de Resumen y vistas nativas de Email, WhatsApp, pendientes de agente, errores técnicos y respuestas incorrectas.
- Publicación privada desde GitHub Actions; enlace de instalación UI compartible dentro del servidor.
- Workflow preparado (no habilitado públicamente) para npm/Marketplace con OIDC/provenance.
- Pruebas locales estructurales y de sintaxis; compilación de SDK y pruebas de servidor todavía pendientes.

## 0.2.0 — Prototipo no desplegado

- FAQs, Consultas, Mensajes, Categorías y Ajustes configurables, con índices y vistas básicas.
