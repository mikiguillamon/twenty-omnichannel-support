# Omnichannel Support 1.0.0: delivery contract and release gates

This is the implementation brief for the first **stable** release. It is not a claim that the current beta or the draft PR is production-ready.

## Confirmed decisions

- The main Twenty navigation is shared by everyone in the **workspace**, not personalized per member.
- User permissions are delegated to Twenty roles. App administration is restricted to users with the corresponding **native administrative permission**.
- A Twenty core upgrade is permitted if necessary, but only after proving that the target version provides the missing behavior and testing against a separate deployment.
- User-created dashboard shortcuts, order, labels and workspace-specific positions must outlive app upgrades.
- The first stable npm distribution must be `1.0.0`, published to `latest` only after the marketplace installation and upgrade have been validated.

## Navigation solution without a core upgrade

Twenty SDK 2.50 cannot hide an arbitrary app-owned sidebar folder based on the current member's role. Instead, the app stops declaring the technical `Omnichannel` folder **and all its app-owned sidebar child entries** in the v1 manifest. The pages, layouts, views, records, object UUIDs, API functions and business data are not deleted.

The app now provides a consolidated administrative center in **Settings > Apps > Administración Omnichannel** via a `WORKSPACE` settings-menu item. Twenty SDK 2.50's `SettingsRoutes.tsx` protects the applications settings route with `PermissionFlagType.APPLICATIONS`. Access to this settings surface is therefore governed by the logged-in user's native **Applications** permission; the integration does not use CSS visibility tricks or a frontend-only `isAdmin` state.

- Admin: manage channels/policies/FAQs/dashboards through the application settings center, and access underlying native objects (subject to record/field permissions).
- Non-Admin without the **Applications** permission: no app-owned technical sidebar or admin settings route; only workspace-created operational shortcuts remain. A non-Admin role that is deliberately granted Applications permission is treated as an app administrator by Twenty, so keep this permission exclusive to designated admins.
- Workspace shortcuts (LINK/page layout/view items created outside the app manifest): their ownership belongs to the workspace, so the app's pruning of **its own** navigation entries must not delete them.
- Preserve user-created links and original page layout identifiers. The removal is restricted to the 11 app-owned menu declarations under `src/navigation-menu-items/`.
- Do not reinstall or reset the app; server metadata sync must be previewed on staging, because missing app-owned entities are pruned.

### One-time migration and validation

1. Export the workspace's current navigation items: ID, type, name, parent ID, target URL/record/layout, position, and ownership.
2. Verify there are independent workspace-owned shortcuts for the operational pages users need; create any missing shortcuts through Twenty's native menu customization BEFORE upgrading.
3. Upgrade a throwaway workspace from the current beta and compare the navigation metadata. Exactly the old app-owned technical folder/children should be removed; no workspace-owned shortcuts should disappear or change identity.
4. Test Admin (app settings permission) and non-Admin roles by logging in separately, and try direct URLs. App UI hiding is not an authorization layer; Twenty's backend permissions must deny unauthorized administrative writes.
5. Verify all old dashboard links and source records. Never remove a page layout, widget, object, field, or view as part of this navigation-only cleanup.

**Note:** Moving the administrative center into Settings instead of keeping it in the main left sidebar is an intentional architecture change needed to meet the UX/security requirement without patching the Twenty core.

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

- [ ] Verify the technical **Omnichannel sidebar folder is absent for all users**, while Admin can open the consolidated settings center and non-Admin cannot.
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
