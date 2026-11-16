# Omnichannel Support for Twenty

Manage conversations across email, chat and phone channels in Twenty CRM.

Omnichannel Support gives your team a place to follow support cases, read messages in context, and keep track of what still needs attention. Cases live alongside your existing Twenty contacts, so you can see the history of an issue without maintaining a separate support database.

## What you can do

- **Follow each enquiry.** Keep incoming and outgoing messages together, with the case's status, category, owner and resolution.
- **Work across channels.** Connect email inboxes, WhatsApp, Instagram, Telegram and phone systems separately in each workspace.
- **Update conversations through the API.** Set status, follow-up, category, language, summary or comments as each new message arrives; preserve call recordings and transcriptions.
- **Open history from People.** Find related conversations and channel identities in the Omnichannel tab on a Person.
- **Choose how conversations become cases.** Keep email replies in the same thread, or group chat messages by activity and topic. Each channel has its own settings.
- **Use your team's knowledge.** Maintain FAQs for connected bots and review automated replies before or after they are sent.
- **See what needs attention.** Choose which KPIs to show in the workspace summary, and create additional graphs and dashboards with Twenty's native editor.

WhatsApp integrations can associate number-based JIDs and LIDs with the same customer identity when the provider supplies reliable matching information.

## How it connects

The app stores cases, messages, FAQs and channel settings in Twenty. To receive or send messages, connect your own email or messaging provider through an automation tool such as **n8n**. The app provides a workspace-authenticated ingestion endpoint that receives normalized events and records identities, contacts, cases, messages and delivery status. Your automation tool only needs to connect to the provider and send one HTTP request.

Omnichannel Support does not include a messaging gateway or an AI service. If you use a bot or a classifier, you configure it in your automation tool.

## Get started

1. Install Omnichannel Support from the Twenty Marketplace in your workspace.
2. Open **Channels** in the support section of Twenty and add the inbox or account you want to connect.
3. In **Conversation management**, choose how messages should be grouped into cases.
4. Connect your provider to n8n and call the app's authenticated ingestion API. Test an incoming message, a retry and a reply before enabling the channel.

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
