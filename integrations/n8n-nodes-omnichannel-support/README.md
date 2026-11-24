# Omnichannel Support for n8n

Community node for the Omnichannel Support app in Twenty CRM. It records conversations in Twenty and passes decisions back to an n8n Wait node. Use your provider's node to deliver the approved reply.

## Connect your workspace

Install Omnichannel Support **1.4.0** on Twenty 2.50. Install the community package `@blackswampai/n8n-nodes-twentycrm` in n8n to provide the **Twenty API** credential type. Select your existing credential in **Omnichannel Support**. The node uses its workspace URL for REST and discovers the function endpoint from Twenty. The credential needs read access to channels and metadata for the selectors and the relevant record permissions for each record operation.

Version 0.2.0 installs node v2 for new workflows and keeps v1 available in existing workflows. To switch an existing step, add a new Omnichannel Support step, select **Twenty API**, and map the inputs before replacing the old step.

## Record a WhatsApp message

Choose **Message → Register Incoming Message**, select the channel, and map the provider's contact identifier, message ID and text. For example, for one WhatsApp Cloud text message object:

| Field | Expression |
| --- | --- |
| Contact or Chat ID | `{{ $json.from }}` |
| Message Identifier | `{{ $json.id }}` |
| Message Text | `{{ $json.text.body }}` |

The channel identifies the account. Later messages from the same direct chat reuse its conversation across days. New incoming chat messages set the status to **In progress**. Add **Message Fields → Occurred At** to use the provider timestamp for activity. Add **Contact Fields → First Name / Last Name** to create a named Person for a new chat identity. With Baileys, provide the observed alternate JID when available.

## Operations

| Resource | Actions |
| --- | --- |
| Message | Register incoming or outgoing messages, update delivery, append by Twenty conversation ID, or propose a reply for review. For email, add **Routing Fields → Thread ID** from Gmail or Outlook. |
| FAQ | Search published FAQs by question, scope and language. Get, list, create, update or delete FAQ records. |
| Case, Case Type, Category, Channel, Conversation View, Dashboard, Evaluation, External Identity, Identity Alias, Setting | Get, list, create, update or delete records with the selected credential's Twenty permissions. Choose workspace fields in the mapper. |
| Message Record | Get, list or update ordinary message details. The approval action belongs to the reviewer in Twenty. |
| Connection | Get the credential fingerprint used to enable protected operations. |

**Conversation Fields** offers workspace status, tags, category, type and follow-up choices. **Additional Custom Tags** accepts new labels. **Get Many → Filter by Field** loads workspace status and tag choices. You can combine filters, set a limit or return all pages.

For **Propose Reply**, **Include Proposed Reply** and **Append Message**, run **Connection → Get Credential Fingerprint** once and copy the result into the Twenty app setting `OMNICHANNEL_N8N_CREDENTIAL_FINGERPRINT`. The node computes the integration proof privately from **Twenty API**. Pair the credential again after rotating its API key. Existing v1 workflows can continue to use the legacy Integration Key.

A proposed reply resumes an n8n **Wait** on **POST** after human review. Send the final text through the provider only when `{{ $json.body.confirmed === true }}`. The [Spanish integration guide](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md) includes the full workflow, examples for each channel and the required Wait settings.

## Build and test

From this package directory, use Node 22.22 or 24 and npm.

```sh
npm ci
npm run lint
npm test
npm pack
```

Run `npm run dev` to try the node locally. The n8n and Twenty packages have independent versions. [Source and releases](https://github.com/mikiguillamon/twenty-omnichannel-support).

## Install from n8n

In self-hosted n8n, sign in as an Owner or Admin, open **Settings → Community Nodes → Install** and enter `n8n-nodes-omnichannel-support`. Accept the prompt for an unverified package and select **Install**. The instance must allow installation of unverified community packages. [n8n GUI installation](https://docs.n8n.io/integrations/community-nodes/installation-and-management/gui-installation/)

## Subsequent npm releases

The node has its own version and lockfile. When preparing the next release, set up the Trusted Publisher under this package's **Settings** on npmjs.com.

| npm setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `mikiguillamon` |
| Repository | `twenty-omnichannel-support` |
| Workflow filename | `publish-n8n-node.yml` |
| Environment name | Leave blank |
| Allowed action | `npm publish` |

From the node directory, use `npm version patch --no-git-tag-version` for a patch release, or select `minor` or `major` as appropriate. Commit the resulting `package.json` and `package-lock.json` changes and merge or push them to `main`.

**Publish Omnichannel n8n node to npm** runs when the node's `package.json` lands on `main`. The workflow skips versions already in npm, validates and packages each new version, then publishes it to `latest` using OIDC and provenance. For a retry, run the same workflow manually on `main` and enter the version in `package.json`. Complete the next publish within two days of setting up the Trusted Publisher to activate the connection. [Publish workflow](https://github.com/mikiguillamon/twenty-omnichannel-support/actions/workflows/publish-n8n-node.yml) · [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
