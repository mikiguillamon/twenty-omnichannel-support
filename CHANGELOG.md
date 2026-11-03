# Changelog

## 0.3.0-beta.4 — candidata para publicación automática (pendiente de npm)

- Nueva versión prerelease para probar GitHub Release → GitHub Actions → npm Trusted Publishing con OIDC y provenance.
- Sin cambios funcionales: conserva los identificadores universales y el modelo de datos de Twenty.
- No publicar la Release hasta verificar que la beta.3 ya se registró y que Trusted Publishing está configurado con `publish.yml` y Environment vacío.


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
