# Checklist para probar Omnichannel Support

Ejecuta estas comprobaciones en un workspace aislado antes de instalar o actualizar una versión para clientes. La batería automatizada del repositorio no sustituye una prueba de sincronización real de Twenty ni del proveedor.

## Instalación y permisos

- [ ] Twenty está dentro de la compatibilidad declarada por el paquete.
- [ ] La app se instala o actualiza sin eliminar registros existentes.
- [ ] Los nueve objetos personalizados están presentes.
- [ ] El menú aparece como **Omnichannel → Conversaciones**.
- [ ] Se conservan las relaciones, categorías, identificadores únicos y claves de mensajes anteriores.
- [ ] Una Persona muestra pestaña Omnichannel con sus conversaciones e identidades vinculadas.
- [ ] El token del workspace puede llamar al endpoint de ingestión y no tiene permisos innecesarios.

## Mensajes y conversaciones

- [ ] Un mensaje nuevo crea o encuentra Canal, identidad externa y Persona cuando existe una coincidencia fiable.
- [ ] Un `externalId` repetido no crea mensajes duplicados.
- [ ] Un segundo `externalId` del mismo hilo actualiza la conversación y puede cambiar `status` o `followUp`.
- [ ] La omisión de `conversation.summary` conserva el resumen anterior.
- [ ] Un evento duplicado no revierte un estado actualizado por otro mensaje posterior.
- [ ] `message.status` cambia la entrega del mensaje existente, sin modificar `supportCases.status`.
- [ ] Se rechazan `categoryId` y `categoryCode` juntos, categorías desconocidas y estados inválidos.
- [ ] Una coincidencia dudosa exige revisión y no fusiona Personas automáticamente.
- [ ] Los valores `AUTOMATED`, `INFORMATIONAL` y `WAITING_INTERNAL` aparecen en la interfaz.

## WhatsApp y otros canales

- [ ] WhatsApp PN/LID y sus cambios de orden no generan identidades falsas.
- [ ] Los grupos WhatsApp no entran por el endpoint de Personas.
- [ ] Dos cuentas del mismo proveedor permanecen aisladas.
- [ ] El Canal `PHONE` aparece en la configuración y acepta un evento de llamada con ID estable.
- [ ] La transcripción se ve en el mensaje y, si procede, en la conversación.
- [ ] La grabación se enlaza mediante HTTPS con protección de acceso.
- [ ] Los Canales desactivados o pausados no provocan envíos automáticos desde n8n.

## Resumen y dashboards

- [ ] Los contadores REST cargan cifras reales o muestran ausencia de datos cuando hay un error.
- [ ] Las tarjetas de KPI se pueden mostrar y ocultar por workspace.
- [ ] La preferencia de visibilidad persiste en `supportSettings`.
- [ ] Las tablas de atención humana y errores técnicos se abren.
- [ ] Se pueden crear gráficos en los dashboards nativos de Twenty para ese workspace.

## Publicación y reversión

- [ ] Pruebas, comprobación de tipos, SDK build y tarball pasan en CI.
- [ ] El paquete contiene licencia y excluye datos y credenciales sensibles.
- [ ] El tag de la release coincide con el `package.json` publicado.
- [ ] Las etiquetas npm `beta` y `latest` responden a la política de ese proyecto.
- [ ] La instalación de prueba conserva los datos y permite volver al flujo anterior de n8n si falla la integración.

Consulta [API Reference](API_REFERENCE.md), [Instalación](INSTALACION.md), [Seguridad](SEGURIDAD.md) y [Publicación](PUBLICACION.md).
