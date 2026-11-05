# Development and contributing

Omnichannel Support is a Twenty SDK app. Its objects, relations, views and front components are defined in `src/`; operational guides live in `docs/`.

## Prerequisites

Use the Node.js and Yarn versions declared in `package.json`. Install dependencies with Corepack:

```bash
corepack enable
corepack yarn install --immutable
```

## Check a change

```bash
corepack yarn release:check
corepack yarn check
corepack yarn test
```

The check command validates the schema, runs TypeScript and builds the Twenty app. The test command covers additional invariants, including WhatsApp JID/LID identity handling. CI also checks that the release tarball contains the MIT license.

Keep existing `universalIdentifier` values stable when changing the schema. Test added fields and relations against a disposable workspace before updating one that contains support data. Changes to the README will also change the Marketplace About page in the next published package.

## Application architecture

- `supportCases` and `supportMessages` store enquiries and individual messages.
- `supportChannels` holds channel settings and conversation policies for email and chat.
- `supportExternalIdentities` and `supportIdentityAliases` track provider-scoped customer identities, including WhatsApp PN JIDs and LIDs.
- `supportFaqs`, `supportCategories`, `supportEvaluations` and `supportSettings` support knowledge management and operations.

The app does not ingest messages, send them, run an AI model or configure n8n. Integrations read and write Twenty through authorized workspace credentials.

Before changing the integration contract, review [the architecture](docs/ARQUITECTURA.md), [n8n integration](docs/INTEGRACION_N8N.md), [conversation policies](docs/POLITICAS_CONVERSACION.md) and [WhatsApp identities](docs/IDENTIFICADORES_WHATSAPP.md).

## Publishing

Versions are immutable on npm. For a public release, update `package.json`, test the packaged output and create a GitHub Release from the verified `main` commit. GitHub Actions handles publishing with npm Trusted Publishing.

Pre-releases use npm's `beta` dist-tag and stable releases use `latest`. A beta publication does not automatically become the default version in the npm registry or the Twenty Marketplace. Check the dist-tags, CI logs and catalog visibility before announcing an upgrade.

Follow the [publishing guide](docs/PUBLICACION.md), the [installation guide](docs/INSTALACION.md) and the [validation checklist](docs/CHECKLIST_PILOTO.md).

## Support and licensing

Report bugs using [GitHub Issues](https://github.com/mikiguillamon/twenty-omnichannel-support/issues). Include the Twenty version, app version and steps to reproduce; remove personal information, message bodies and credentials from logs.

The project is distributed under the [MIT license](LICENSE).
