# Omnichannel Support for Twenty

Manage customer enquiries and conversation history in Twenty CRM.

Omnichannel Support gives your team a place to follow support cases, read messages in context, and keep track of what still needs attention. Cases live alongside your existing Twenty contacts, so you can see the history of an issue without maintaining a separate support database.

## What you can do

- **Follow each enquiry.** Keep incoming and outgoing messages together, with the case's status, category, owner and resolution.
- **Work across channels.** Set up separate email inboxes, WhatsApp numbers, Instagram accounts and Telegram bots for each workspace.
- **Choose how conversations become cases.** Keep email replies in the same thread, or group chat messages by activity and topic. Each channel has its own settings.
- **Use your team's knowledge.** Maintain FAQs for connected bots and review automated replies before or after they are sent.
- **See what needs attention.** Find cases waiting for a person, inspect technical errors and review support activity from Twenty.

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

The application exposes an authenticated `POST /s/omnichannel/v1/ingest` endpoint for integrations. It accepts email, WhatsApp, Instagram and Telegram events and handles contact matching, conversation linking and message deduplication inside Twenty. Sending messages still happens through your chosen provider.

[Read the ingestion API guide](docs/INGESTION_API.md) for payload examples, authentication and rollout considerations.

## Guides

- [Installation and first setup](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INSTALACION.md)
- [Connecting n8n and Twenty](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md)
- [Conversation rules for email and chat](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/POLITICAS_CONVERSACION.md)
- [Source code and developer documentation](https://github.com/mikiguillamon/twenty-omnichannel-support)

Free and open source under the [MIT license](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/LICENSE).
