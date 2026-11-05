# Omnichannel Support for Twenty CRM

An open-source support workspace for Twenty CRM, distributed under the MIT license. It keeps customer support cases, messages, FAQs, channels, human reviews, and reporting in Twenty, with separate records and configuration for each workspace.

Email, WhatsApp, Instagram and Telegram delivery are handled by external providers and automations, such as n8n. The app does not send or receive messages on its own.

## Features

- Eight native Twenty objects: Cases, Messages, FAQs, Categories, Channels, Evaluations, Support Settings, and External Identities.
- Connections to Twenty's existing People and Task records.
- A chronological conversation viewer within each case.
- Support views for email, WhatsApp, agent follow-up, and technical errors.
- A summary page showing total cases, human follow-ups, technical errors, and incorrect evaluations.
- Configurable channel instances for email, WhatsApp, Instagram and Telegram, each with operational status and reported health.
- A user-friendly **Conversation management** tab in Channels, with individual routing policies per channel (thread, message, hybrid, session and manual).
- External identities linked to native People and Cases, including provider-scoped IDs that are not phone numbers.
- Unique external keys to help prevent duplicate cases and messages.
- FAQs grouped by category, language and publication state.

A case represents one support issue, which may contain multiple messages. Each message records its direction, sender, content, reply decision and delivery status. Technical success, issue resolution and human evaluation remain independent.

## Requirements

Check the published package's `engines.twenty` compatibility range before installation. Each workspace needs its own authorized credentials for any external integration.

## Installation

Install the application through the Twenty app catalog when available, or through an authorized private distribution link. Check the seven objects and their relationships, create channel instances and categories, and test the setup with sample records before connecting real communication providers.

See [Installation](docs/INSTALACION.md) and [Validation checklist](docs/CHECKLIST_PILOTO.md).

## Using n8n

n8n receives events from email and WhatsApp providers, resolves the customer and case in Twenty, records messages, makes routing or reply decisions and saves real delivery outcomes.

Use the Twenty node available in your n8n installation for supported CRM operations. Before adopting a workflow, confirm that the specific node version supports custom Twenty objects and relationships. Consult the API Playground in Twenty to verify the generated schema. The examples in this repository describe workflow behavior and field mappings; they are not importable n8n workflows. n8n reads the routing policy from each Channel record and, if configured, performs semantic classification with its own AI nodes and credentials.

See [n8n integration](docs/INTEGRACION_N8N.md) and [Data model](docs/ARQUITECTURA.md).

## Known limits

- The app does not configure communication providers, call AI models or operate n8n workflows automatically.
- For existing channel records, open the Conversation management tab and save the desired policy after upgrading. Policy fields created by the upgrade may initially be empty.
- Pausing or disabling a channel in Twenty takes effect only when the integration checks channel status.
- The conversation widget shows up to 100 messages; the native message relationship remains available for longer histories.
- Attachments and rich email content need a separate storage and processing strategy.
- A draft is not a sent message. Delivery statuses require actual provider acknowledgements.
- Dashboard queries and permissions must be validated in the deployed Twenty version.

## Development

Use the Node.js and Yarn versions specified in `package.json` and its package manager field.

```bash
corepack enable
corepack yarn install --immutable
corepack yarn release:check
corepack yarn check
corepack yarn test
```

For public builds, verify the manifest and distributable tarball, including the MIT `LICENSE`, before publishing with the Twenty CLI. See [Publishing](docs/PUBLICACION.md).

## Documentation

- [Architecture and data model](docs/ARQUITECTURA.md)
- [Installation and upgrade](docs/INSTALACION.md)
- [n8n integration](docs/INTEGRACION_N8N.md)
- [Conversation routing policies](docs/POLITICAS_CONVERSACION.md)
- [Channel configuration](docs/CONFIGURACION_CANALES.md)
- [Daily operations](docs/OPERATIVA.md)
- [Dashboard](docs/DASHBOARD.md)
- [Security and privacy](docs/SEGURIDAD.md)
- [Validation checklist](docs/CHECKLIST_PILOTO.md)
- [Publishing](docs/PUBLICACION.md)
- [Changelog](CHANGELOG.md)

## License

MIT. See [LICENSE](LICENSE).
