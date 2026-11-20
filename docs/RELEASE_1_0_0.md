# Omnichannel Support 1.0.0: delivery contract and release gates

This is the implementation brief for the first **stable** release. It is not a claim that the current beta or the draft PR is production-ready.

## Confirmed decisions

- The main Twenty navigation is shared by everyone in the **workspace**, not personalized per member.
- User permissions are delegated to Twenty roles. App administration is restricted to users with the corresponding **native administrative permission**.
- A Twenty core upgrade is permitted if necessary, but only after proving that the target version provides the missing behavior and testing against a separate deployment.
- User-created dashboard shortcuts, order, labels and workspace-specific positions must outlive app upgrades.
- The first stable npm distribution must be `1.0.0`, published to `latest` only after the marketplace installation and upgrade have been validated.

## SDK 2.50 findings and non-negotiable limitation

The application currently defines a shared `Omnichannel` folder and its static child menu entries using `defineNavigationMenuItem`. Twenty SDK `2.50.0` does **not** expose a role visibility expression or permission requirement on an arbitrary folder. A normal member who can see the workspace sidebar may consequently see the folder even without permission to perform privileged operations.

`canAccessFullAdminPanel` exists for conditional **command-menu availability** but does not make ordinary navigation manifest entries role-specific. Updating to a newer Twenty core is not, on its own, proof of a solution: the manifest used by the target version must expose an independently tested mechanism.

**Blocker:** `1.0.0` must not be published while a non-Admin can see the Omnichannel administrative folder if the user contract requires it to be completely hidden. Hiding the folder with CSS or rendering an empty component is not an acceptable security or UX workaround.

The draft branch adds a secondary, native **Settings > Apps > Administración Omnichannel** center, which consolidates:
- Existing dashboard and FAQ managers;
- Channel setup and conversation policies;
- Navigation to native records: conversations, messages, channels, FAQs, types, categories, evaluations, external identities, aliases and application settings.

This is a useful administrative entry point but **not** yet a replacement for role-filtered sidebar navigation. Its access follows native Twenty app settings permissions, not a custom false `isAdmin` client flag.

## Migration invariants

1. Do not delete or repurpose existing `universalIdentifier` values for navigation, records, layouts, fields, indexes, app roles or logic functions.
2. Never rewrite links owned by workspace members or the workspace customization UI. Keep dashboard deep links of the form `?omniDashboard=<id>`.
3. Keep `/s/omnichannel/v1/ingest` and `/s/omnichannel/v1/faqs/search`, payload validation, contact matching, statuses, aliases and message deduplication behavior unchanged unless a new contract is explicitly versioned.
4. Until a dedicated dashboard object and migration mechanism exist, preserve `supportSettings` dashboard keys `omnichannel.dashboard.v2.<id>`. The layout adds optional `height`, normalized when loading pre-existing dashboard records; this does **not** constitute a destructive migration.
5. Introduce a dedicated dashboard settings storage with a separate Twenty object permission only once safe migration, idempotence, retry, rollback and access by non-Admin members have been demonstrated. In particular, do **not** grant broad read access to all of `supportSettings` solely to display a KPI.
6. Existing FAQs, their publication status and scope tags, and the new optimistic toggle behavior must survive upgrades.

## Authorization design

- **Member screens:** use user-scoped `RestApiClient` and Twenty's record/field permissions.
- **Admin screens:** first gate access at a native permissions boundary, then ensure every administrative mutation has server-side authorization; no secret, permanent application credential or client-only role flag.
- **Bots/n8n:** remain authenticated via their own workspace API keys. FAQ scope filters are query restrictions, not security boundaries.
- **Admin endpoint tests:** user with no application administration permission must receive a denial even with a direct URL or an intentionally crafted HTTP request.
- **Role change tests:** an Admin downgraded to Member should lose access promptly, including after fresh login and navigation state refresh.

## Dashboard design acceptance

- Drag from each widget header onto a neighboring widget reorders without arrow controls.
- Resize with the bottom-right corner handle, snap widths to 3/4/6/8/12 of 12 columns, snap heights to 2–12 rows.
- A widget card presents only Configure and Delete actions. The resize handle is an affordance, not an extra action button.
- Equivalent ordering and size controls remain accessible with the keyboard and within the settings panel.
- Store and reload without changing source, aggregation, filters, date range, widget ID, dashboard ID or deep link.
- Validate light and dark mode, narrow screens, pointer movement across elements, cancellation and errors.
- Remote DOM sandboxing must be validated on an actual Twenty installation; successful TypeScript compilation is not a substitute for that browser test.

## Stable release gates

- [ ] Test and adopt a supported mechanism that hides the **Omnichannel sidebar folder** from non-Admins while displaying it for Admins, without widening access.
- [ ] Verify all navigation and workspace-owned shortcuts survive an actual beta-to-stable upgrade.
- [ ] Isolate dashboard access from broad `supportSettings` rights and perform a reversible migration for existing workspaces.
- [ ] Finish coherent UI review of all existing app surfaces.
- [ ] Validate keyboard, pointer, mobile, dark mode and screen-reader access of dashboards and FAQ manager in Twenty's Remote DOM.
- [ ] Exercise Twenty roles Admin/Member/read-only, direct URLs and forged admin API requests.
- [ ] Exercise FAQs, categories, types, channel policies, identity aliases, message grouping and n8n ingestion end-to-end.
- [ ] Pass `corepack yarn release:check && corepack yarn check && corepack yarn test`.
- [ ] Pass clean install **and** upgrade using a real nonproduction Twenty workspace and an idempotent migration.
- [ ] Complete backup, restore and rollback rehearsal.
- [ ] Tag GitHub `v1.0.0`, publish exact npm `1.0.0`, verify `npm dist-tags.latest`, then verify the Twenty Marketplace and installed workspace.

No change to the installed Twenty core, production workspace or npm `latest` should happen as a side effect of working on this draft branch.
