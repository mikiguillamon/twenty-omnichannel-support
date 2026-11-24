# Omnichannel Support for n8n

Community node for the Omnichannel Support app in Twenty CRM. It records conversations in Twenty and passes decisions back to an n8n Wait node. Use your provider's node to deliver the approved reply.

| Operation | Main inputs |
| --- | --- |
| Register Incoming Message | Channel code, channel type and a provider message ID or stable idempotency key |
| Propose Reply | Twenty message ID, proposed text and the current execution's Wait URL |
| Append Message | Twenty conversation ID, new provider message ID or stable idempotency key, and message text |
| Update Delivery Status | Channel code, provider message ID and delivery status |

## Credentials

Install Omnichannel Support 1.3.0 or later in the target Twenty workspace. Configure **Omnichannel Support API** with the workspace HTTPS URL and its Twenty API key. For **Propose Reply** and **Append Message**, set **Integration Key** to the app's `OMNICHANNEL_N8N_PROPOSAL_SECRET`.

If Twenty publishes functions on a separate domain, set **Functions Base URL** to the full Omnichannel API base shown there, for example `https://functions.example.com/omnichannel/v1`. Leave it empty to use `/s/omnichannel/v1` on the workspace URL.

The integration guide covers Wait and the approved-text mapping. The API reference describes IDs, retries and error codes. [Integration guide](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/INTEGRACION_N8N.md) · [API reference](https://github.com/mikiguillamon/twenty-omnichannel-support/blob/main/docs/API_REFERENCE.md).

## Build and test

From this package directory, use Node 22.22 or 24 and npm.

```sh
npm ci
npm run lint
npm test
npm pack
```

Run `npm run dev` to try the node locally with the n8n CLI. To test a packed build on self-hosted n8n, make the tarball available to the n8n process, install it with `npm install /path/to/n8n-nodes-omnichannel-support-0.1.0.tgz` in the instance's `~/.n8n/nodes` directory, then restart the instance. In queue mode, install the same build wherever workflows execute. [Manual installation in n8n](https://docs.n8n.io/integrations/community-nodes/installation-and-management/manual-installation/).

## First npm release

The npm account that will own the package publishes the first version. Download and unzip the `n8n-nodes-omnichannel-support` artifact from a successful **Verify Omnichannel n8n node** run on `main`, or use the tarball from `npm pack`. [Builds on GitHub Actions](https://github.com/mikiguillamon/twenty-omnichannel-support/actions/workflows/n8n-node.yml)

```sh
npm login --registry=https://registry.npmjs.org
npm publish ./n8n-nodes-omnichannel-support-0.1.0.tgz --registry=https://registry.npmjs.org --access public --tag latest --provenance=false
npm view n8n-nodes-omnichannel-support dist-tags --json
```

Complete npm's two-factor prompt if requested. The command publishes the tested archive directly and should report `latest: 0.1.0` on verification. [Publishing a public package on npm](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)

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
