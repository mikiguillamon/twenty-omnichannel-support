# Arquitectura y modelo de datos

## Reglas del diseño

Twenty sigue siendo la fuente de verdad para contactos, consultas y su historial. Los bots de n8n procesan, clasifican y envían; registran el resultado mediante API y nunca necesitan una base de datos de soporte paralela. Cada workspace contiene sus propios registros y API keys.

El diseño distingue tres hechos que no se deben confundir:

1. **Estado técnico** (`supportCases.technicalStatus`): si el bot o el workflow pudo ejecutarse.
2. **Resultado operativo** (`supportCases.resolution`): si el problema del cliente quedó solucionado.
3. **Evaluación humana** (`supportEvaluations.verdict`): si una revisión consideró correcta la actuación, con cobertura explícita de cuántas interacciones se revisaron.

## Modelo

```text
Twenty Person ──1:N── Support Case ──1:N── Support Message
                         │                    │
                         ├────1:N── Evaluation└──1:N── Evaluation
                         │
                         ├────N:1── Support Channel
                         └────N:1── Support Category ──1:N── Support FAQ

Support Channel (1) ── (N) External Identity ── (N:1) Twenty Person
                                 │
                                 ├──── (1:N) Support Case
                                 └──── (1:N) Identity Alias

Support Setting: claves/valores por workspace, sin secretos.
```

**Campos principales**

| Objeto API (plural) | Finalidad | Valores comunes |
|---|---|---|
| `supportCases` | Caso/hilo de atención | externalKey, status, technicalStatus, resolution, automation, person, channelInstance, category, fechas |
| `supportMessages` | Mensaje individual o propuesta | externalKey, supportCase, direction, senderType, body, draftBody, replyDecision, deliveryStatus, occurredAt |
| `supportChannels` | Instancias email/WhatsApp/Instagram/Telegram y su política | code, channelType, provider, status, health, groupingMode, continuationHours, reopenHours |
| `supportExternalIdentities` | Identidad lógica por cuenta/proveedor, compartida por varios alias | externalKey, externalUserId, externalAccountId, person, channelInstance, verified |
| `supportIdentityAliases` | PN JID, LID y otros identificadores observados para una misma identidad | externalKey, aliasValue, aliasType, externalIdentity, evidence |
| `supportEvaluations` | Revisión humana | targetScope, supportCase, supportMessage, task (relación a Task nativa), verdict, proposedCorrection, reviewer, reviewedAt |
| `supportFaqs` | Conocimiento aprobado | question, answer, status, language, category, revision, publishedAt |
| `supportCategories` | Categorías configurables | name, code, enabled, description |
| `supportSettings` | Configuración no secreta | key, valueType, valueText/valueNumber/valueBoolean, enabled |

**Claves externas únicas:** los índices de Consultas, Mensajes, identidades y alias ayudan a resolver reintentos y concurrencia. Cada tipo de registro necesita su propia clave. Una Consulta de email puede utilizar una clave de hilo del proveedor; una Consulta de chat necesita un identificador estable por asunto. Los Mensajes usan el ID original del proveedor y el Canal. Nunca usar el JID o LID de un cliente como clave permanente de una Consulta.

**Doble dimensión de canal:** `supportCases.channel` es un SELECT común para filtros y gráficos nativos; `channelInstance` es la relación al buzón/número concreto. El integrador debe escribir ambos de forma coherente. No se modifica el valor directamente desde la UI sin revisar su instancia.

Las etiquetas predeterminadas `MULTI_SELECT` son compartidas; `customTags` es un ARRAY de textos para etiquetas propias por cliente. Las categorías y ajustes se mantienen como registros editables. Las etiquetas libres se escriben en `customTags`; los valores de `tags` son opciones definidas en el esquema.

## Páginas

- `Atención al cliente → Resumen`: standalone page dentro de Twenty, con cuatro contadores y tablas de pendientes y errores. El componente de contadores obtiene `totalCount` mediante GraphQL y muestra **sin datos** si la consulta falla, nunca inventa ceros.
- `Consultas`: objeto Twenty con vistas filtradas por Email, WhatsApp, Agente y Errores.
- `Detalle de consulta`: campos y relaciones nativas; visor cronológico React sobre la REST API usando el token **del usuario que mira la pantalla**, no un token de administrador.
- `Evaluaciones`: objeto nativo con vistas para revisar respuestas incorrectas.
- `Canales`: estado y última actividad por integración; pestaña Gestión de consultas para editar las políticas independientes de cada Canal.
- `Identidades externas`: relación entre usuario de plataforma, Persona, Canal y Consultas.

Los dashboards nativos adicionales de Twenty se configuran por separado (ver [Dashboards](DASHBOARD.md)).

## Trabajo por API

La API autogenerada de Twenty expone los nueve objetos. La app no implanta por ahora un endpoint alternativo de ingestión: las integraciones trabajan con los modelos y permisos de Twenty. Antes de configurar un workflow de n8n, inspecciona el API Playground del workspace para verificar la forma de relaciones y filtros en la versión realmente desplegada.

## Separación y actualización

- Los identificadores universales de todos los objetos, campos, vistas, índices y layouts son **estables**.
- Los datos y credenciales nunca se copian entre workspaces.
- Publicar una versión nueva requiere subir `version` en `package.json`.
- Para modificaciones de esquema en producción, revisar plan de cambios, campos que pueden eliminarse y compatibilidad de n8n antes de aplicar.

## Agrupación por canal

La app guarda la política en cada registro de Canal. Para Email, por defecto se conserva un caso por hilo (o se puede optar por uno por correo entrante). En WhatsApp, Instagram y Telegram se ofrecen agrupación inteligente, por actividad y manual. n8n aplica las reglas con el nodo Twenty CRM y puede llamar a un clasificador de IA desde n8n cuando se permite; Twenty no realiza inferencias. Véase [POLITICAS_CONVERSACION.md](POLITICAS_CONVERSACION.md).

## Identificadores alternativos de WhatsApp

Una cuenta puede entregar un PN JID y un LID del mismo interlocutor en `remoteJid` / `remoteJidAlt` sin orden garantizado. Se guardan en `supportIdentityAliases` asociados a una única `supportExternalIdentity`. Ante alias que apuntan a identidades distintas, no fusionar automáticamente. Los Mensajes conservan ambos campos originales de direccionamiento y el ID real del mensaje. Véase [IDENTIFICADORES_WHATSAPP.md](IDENTIFICADORES_WHATSAPP.md).
