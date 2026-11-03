# Checklist de aceptación — piloto 0.3.0-beta.1

## Distribución

- [ ] Nuevo repositorio de la app con CI verde.
- [ ] GitHub Actions privado configurado con el workspace **propietario** (no el de un cliente accidentalmente).
- [ ] App publicada privadamente tras cambiar versión si ya existía.
- [ ] Enlace **Distribution → Copy share link** verificado.
- [ ] Instalación desde interfaz Twenty en el workspace piloto, sin Terminal.
- [ ] Se comprueba actualización posterior con un número semver mayor.

## Modelo y API

- [ ] Siete objetos y siete parejas de relaciones visibles.
- [ ] Relación Persona → Consultas → Mensajes y Evaluaciones.
- [ ] Categorías, ajustes y canales creados/actualizados desde Twenty UI.
- [ ] Claves externas únicas: reintentos no duplican mensajes.
- [ ] REST/GraphQL para FAQ, categoría, canal, consulta, mensaje y evaluación verificado con API Playground.
- [ ] Un token de n8n por workspace, permisos mínimos.

## UI

- [ ] `Resumen` carga contadores reales o aviso explícito de error.
- [ ] `Pendientes de agente` y `Errores técnicos` se filtran correctamente.
- [ ] Detalle de consulta muestra campos, visor de chat y evaluaciones.
- [ ] Visor ordena por occurredAt; cuerpos largos se muestran sin HTML inseguro.
- [ ] Contraste legible en modo claro y oscuro.
- [ ] Permisos de usuarios restringidos no exponen contenido ni widgets indebidos.

## Operativa

- [ ] Email entrante y borrador/salida representados por mensajes distintos o estados distinguibles.
- [ ] WhatsApp entrante/saliente se muestra por orden.
- [ ] Al responder SKIP se registra decisión sin falsear un envío.
- [ ] Estado técnico SUCCESS y resultado UNSOLVED pueden coexistir.
- [ ] Evaluación INCORRECT registra propuesta de corrección y seguimiento.
- [ ] Channel health y heartbeat no se inventan cuando no hay señal.

## Condiciones de publicación pública

- [ ] NPM metadata y logo validados.
- [ ] Licencia, privacidad, retención, soporte y costes decididos.
- [ ] Repo/CI preparado para provenance y Claim with GitHub.
- [ ] No se rompe la app Meta Lead Sync ni el workspace jff.
- [ ] No se modifica ningún workflow n8n sin aprobación del usuario.
