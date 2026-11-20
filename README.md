# Omnichannel Support for Twenty

Manage conversations across email, chat and phone channels in Twenty CRM.

Omnichannel Support gives your team a place to follow support cases, read messages in context, and keep track of what still needs attention. Cases live alongside your existing Twenty contacts, so you can see the history of an issue without maintaining a separate support database.

## What you can do

- **Follow each enquiry.** Keep incoming and outgoing messages together, with the case's status, category, owner and resolution.
- **Work across channels.** Connect email inboxes, WhatsApp, Instagram, Telegram and phone systems separately in each workspace.
- **Update conversations through the API.** Set the title, type, category, status, standard/custom tags, follow-up and other metadata whenever a new message arrives; preserve call recordings and transcriptions.
- **Open history from People.** Find related conversations and channel identities in the Omnichannel tab on a Person.
- **Choose how conversations become cases.** Keep email replies in the same thread, or group chat messages by activity and topic. Each channel has its own settings.
- **Manage FAQs visually.** Browse grouped cards, filters and a native Twenty side-panel editor. Activate or deactivate an FAQ immediately without reloading the list; failed updates revert that card. The original Twenty records view stays available. Scope tags (GENERAL, VERANO, etc.) let bots retrieve only the relevant published answers.
- **Build custom dashboards.** Configure KPIs, charts, date ranges, comparisons and filters. Rearrange widgets by dragging them, adjust sizes, and copy an internal link for each dashboard to add it anywhere in Twenty's sidebar. Clear charts and honest empty/error states make the data easier to read. Analytics warns when a dataset exceeds its safe query limit.

WhatsApp integrations can associate number-based JIDs and LIDs with the same customer identity when the provider supplies reliable matching information.

## How it connects

The app stores cases, messages, FAQs and channel settings in Twenty. To receive or send messages, connect your own email or messaging provider through an automation tool such as **n8n**. The app provides a workspace-authenticated ingestion endpoint that receives normalized events and records identities, contacts, cases, messages and delivery status. Your automation tool only needs to connect to the provider and send one HTTP request.

Omnichannel Support does not include a messaging gateway or an AI service. If you use a bot or a classifier, you configure it in your automation tool.

## Get started

1. Install Omnichannel Support from the Twenty Marketplace in your workspace.
2. As an administrator with permission to manage workspace applications, open **Settings > Applications > Omnichannel Support > Administración Omnichannel** to add your channels.
3. In **Políticas por canal**, choose how messages should be grouped into cases.
4. Connect your provider to n8n and call the app's authenticated ingestion API. Test an incoming message, a retry and a reply before enabling the channel.

## Beta 27: safe transition to 1.0.0

**This beta intentionally keeps the original Omnichannel sidebar folder and its 10 child entries.** Twenty 2.50 deletes workspace-created links nested inside a retired app-owned folder when removing that folder. Beta 27 provides an admin tool to prepare that migration before the stable release.

As a workspace administrator, open **Settings > Applications > Omnichannel Support > Administración Omnichannel > Datos y ajustes > Preparar el menú para Omnichannel 1.0**. Click **Inspeccionar menú**, and, if any workspace-created shared links are inside the technical folder, use **Proteger accesos compartidos**. Review personal links directly in Twenty; the tool does not rewrite user-specific items. Repeat inspection until no shared links remain, and create any desired workspace-owned operational shortcuts.

Beta 27 includes dashboard storage and UI improvements but does **not** remove the old sidebar. That removal is reserved for the stable 1.0.0 after a verified migration. See [installation and migration](docs/INSTALACION.md).

## Workspace navigation and permissions

In the upcoming 1.0.0, Omnichannel keeps its administrative tools in **Settings > Applications > Omnichannel Support > Administración Omnichannel**, rather than forcing a technical folder onto every member's main sidebar. Beta 27 retains the folder temporarily for safe migration. This center includes dashboards, FAQs, channels and policies, plus shortcuts to Twenty's native case/message/category/type/identity/evaluation/settings objects.

Dashboards now use a dedicated `supportDashboards` object with independent permissions. On an upgrade, an administrator uses **Migrar dashboards antiguos** in the Settings center to copy legacy configurations without deleting their previous records. Members need read access to `supportDashboards`, not to administrative `supportSettings`.

Users see only the workspace shortcuts that an administrator chooses to create outside the application, such as a published FAQ view, a dashboard deep link or the conversations table. In the final 1.0.0 the app will not manage those workspace-owned shortcuts, and upgrades must not delete or reorder them. Beta 27 still includes original app-owned menu entries.

Workspace roles determine actual record and API permissions. Removing the technical sidebar is an information-architecture change, not a substitute for permissions. Grant workspace application administration only to trusted admins, and grant normal members the specific object access needed for their job.

**Upgrading from a beta:** before applying the migration, back up the workspace menu and verify that every shortcut you want to retain is workspace-owned. App-owned Omnichannel entries are retired on upgrade, even if someone previously dragged one outside its original folder. Create independent Twenty menu links for those entries before upgrading. Never uninstall the app to perform this navigation migration.

## Automatic chat grouping

Choose **Automatic grouping** (HYBRID) or **Activity session** (SESSION) in each channel's conversation settings. The ingestion API can append new inbound and outbound messages to the same eligible conversation, including automated notices, without a separate search in n8n. It respects the channel's continuity and reopening windows, never guesses between multiple active cases, and applies `conversation.status` when a new message is recorded.

## Conversation types and FAQ scopes

A conversation's **Type** uses a workspace-managed catalog, just like **Category**. When the API receives an unknown `conversation.typeCode` or `conversation.categoryCode`, it creates a record with identical name and code in that workspace, then links it to the conversation. Existing entries are reused without changing their names or settings; disabled entries stay disabled. Existing tags and statuses remain available, and the ingestion endpoint updates only the metadata explicitly supplied on each new message.

FAQs have an independent multi-value **Scope** field. For example, a summer bot may fetch FAQs scoped to GENERAL or VERANO, while skipping other scopes and draft FAQs. Scope filtering is an integration rule, not a replacement for workspace access controls.

## Search approved FAQs from a bot

Your bot can ask the authenticated `POST /s/omnichannel/v1/faqs/search` endpoint a natural-language question and receive a short list of relevant approved answers. The search is deterministic and works across Spanish and Catalan, including FAQ variants, accented query spellings and common equivalents. It uses no LLM, embedding provider or separate database.

Each request can specify `scopeTags` (for example `["VERANO"]`) alongside the question. `GENERAL` is always included; if omitted, the scope filter is restricted to `GENERAL` alone. The endpoint reuses Twenty's workspace Bearer authentication and has no bot secrets or bot registry. Scope tags are query filters, not authorization boundaries: a valid client can request other scopes. See [API reference](docs/API_REFERENCE.md) and [n8n integration](docs/INTEGRACION_N8N.md).

## Ingestion API

The application exposes an authenticated `POST /s/omnichannel/v1/ingest` endpoint for integrations. It accepts email, WhatsApp, Instagram, Telegram and phone events and handles contact matching, conversation linking and message deduplication inside Twenty. Sending messages still happens through your chosen provider.

[Read the complete API reference](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/API_REFERENCE.md) for endpoints, fields, validation rules, response codes and examples. See the [integration guide](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md) for n8n setup.

## Guides

- [API reference](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/API_REFERENCE.md)
- [Daily operations and conversation statuses](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/OPERATIVA.md)
- [Workspace dashboards](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/DASHBOARD.md)

- [Installation and first setup](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INSTALACION.md)
- [Connecting n8n and Twenty](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md)
- [Conversation rules for email and chat](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/POLITICAS_CONVERSACION.md)
- [Source code and developer documentation](https://github.com/mikiguillamon/twenty-omnichannel-support)

Free and open source under the [MIT license](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/LICENSE).


### Personas y llamadas

La API de ingestión admite `contact.firstName` y `contact.lastName`. Se guardan en el nombre nativo de la Persona de Twenty y, cuando se identifica de forma segura una Persona existente, se completan los campos vacíos sin sobrescribir los datos que ya tenga.

Los canales `PHONE` registran llamadas y sus transcripciones. Una `message.callRecordingUrl` HTTPS se muestra con reproductor de audio en el historial de la conversación; no hace falta adjuntar el archivo a Twenty. Para mantener los audios protegidos, almacénalos en un servicio con control de acceso y revisa la caducidad de sus enlaces. Consulta [API reference](docs/API_REFERENCE.md) para el contrato completo.
