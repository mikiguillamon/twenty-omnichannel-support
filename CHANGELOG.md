# Changelog

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
