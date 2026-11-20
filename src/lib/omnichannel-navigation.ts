import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { IDS } from '../constants/ids.ts';
import { isPublishedDashboardLink, validateNavigationName } from './dashboard-navigation.ts';

const PAGE_LAYOUT_IDENTIFIERS = new Set<string>([
  IDS.LAYOUT_ADMIN_FULL,
  IDS.LAYOUT_CONVERSATION_INBOX,
  IDS.LAYOUT_SUPPORT_HOME,
  IDS.LAYOUT_FAQ_MANAGER,
  IDS.LAYOUT_CHANNEL_SETUP,
]);
const OBJECT_IDENTIFIERS: string[] = Object.entries(IDS)
  .flatMap(([key, value]) => key.endsWith('_OBJECT') ? [value] : []);
const INTERNAL_ORIGIN = 'https://internal.invalid';

export type OmnichannelMenuEntry = {
  id: string;
  name: string;
  type: 'PAGE_LAYOUT' | 'LINK' | 'VIEW' | 'OBJECT';
  target: string;
  targetName: string;
  folderId: string | null;
  icon: string | null;
  canUnpublish: boolean;
};

function parseWebUrl(value: string, base?: string): URL | null {
  if (value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, base);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return url;
  } catch {
    return null;
  }
  return null;
}

function parseInternalUrl(link: string, workspaceOrigins: Set<string>): URL | null {
  const relative = link.startsWith('/');
  const url = parseWebUrl(link, relative ? INTERNAL_ORIGIN : undefined);
  if (!url || !(relative ? url.origin === INTERNAL_ORIGIN : workspaceOrigins.has(url.origin))) return null;
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

function menuDestination(link: string, workspaceOrigins: Set<string>): string | null {
  const url = parseInternalUrl(link, workspaceOrigins);
  if (!url) return null;
  url.searchParams.sort();
  return `${url.pathname}${url.search}${url.hash}`;
}

async function readOmnichannelNavigation(client: MetadataApiClient) {
  const result = await client.query({
    currentWorkspace: { workspaceCustomApplicationId: true, workspaceUrls: { customUrl: true, subdomainUrl: true } },
    navigationMenuItems: {
      id: true, name: true, type: true, link: true, pageLayoutId: true,
      targetObjectMetadataId: true, viewId: true, folderId: true, icon: true, position: true,
      applicationId: true, userWorkspaceId: true,
    },
    getPageLayouts: {
      __args: { pageLayoutType: 'STANDALONE_PAGE' },
      id: true, universalIdentifier: true, name: true,
    },
    objects: {
      __args: { filter: { universalIdentifier: { in: OBJECT_IDENTIFIERS } }, paging: { first: OBJECT_IDENTIFIERS.length } },
      edges: { node: { id: true, universalIdentifier: true, namePlural: true, labelPlural: true } },
    },
    getViews: { id: true, name: true, objectMetadataId: true },
  });
  const owner = result.currentWorkspace?.workspaceCustomApplicationId;
  if (!owner || !Array.isArray(result.navigationMenuItems)) throw new Error('NAVIGATION_UNAVAILABLE');
  const urls = result.currentWorkspace?.workspaceUrls;
  const workspaceOrigins = new Set([urls?.customUrl, urls?.subdomainUrl].flatMap(value => {
    const url = value ? parseWebUrl(value) : null;
    return url ? [url.origin] : [];
  }));

  const rows = result.navigationMenuItems.filter(item =>
    item.userWorkspaceId === null && item.applicationId === owner,
  ).sort((first, second) => first.position - second.position);
  const layouts = new Map(result.getPageLayouts
    .filter(layout => PAGE_LAYOUT_IDENTIFIERS.has(layout.universalIdentifier))
    .map(layout => [layout.id, layout]));
  const objects = result.objects.edges.map(({ node }) => node)
    .filter(object => OBJECT_IDENTIFIERS.includes(object.universalIdentifier));
  const objectsById = new Map(objects.map(object => [object.id, object]));
  const objectsByPath = new Map(objects.map(object => [`/objects/${object.namePlural}`, object]));
  const views = new Map(result.getViews.map(view => [view.id, view]));
  const entries: OmnichannelMenuEntry[] = [];

  for (const item of rows) {
    const common = {
      id: item.id, folderId: item.folderId ?? null, icon: item.icon ?? null,
      canUnpublish: false,
    };
    if (item.type === 'PAGE_LAYOUT') {
      const layout = item.pageLayoutId ? layouts.get(item.pageLayoutId) : undefined;
      if (layout) entries.push({ ...common, type: item.type,
        name: item.name ?? layout.name, target: `/page/${layout.id}`, targetName: layout.name });
    } else if (item.type === 'LINK' && item.link) {
      const url = parseInternalUrl(item.link, workspaceOrigins);
      if (!url) continue;
      const layout = layouts.get(url.pathname.replace(/^\/page\//, ''));
      const object = objectsByPath.get(url.pathname);
      const viewId = url.searchParams.get('viewId');
      const view = viewId ? views.get(viewId) : undefined;
      const targetName = layout?.name ?? (
        object && (!viewId || view?.objectMetadataId === object.id) ? view?.name ?? object.labelPlural : undefined
      );
      if (targetName) entries.push({ ...common, type: item.type, name: item.name ?? item.link,
        target: item.link, targetName, canUnpublish: layout?.universalIdentifier === IDS.LAYOUT_SUPPORT_HOME && isPublishedDashboardLink(item, owner) });
    } else if (item.type === 'VIEW' && item.viewId) {
      const view = views.get(item.viewId);
      const object = view && objectsById.get(view.objectMetadataId);
      if (view && object) entries.push({ ...common, type: item.type, name: view.name,
        target: `/objects/${object.namePlural}?viewId=${view.id}`, targetName: object.labelPlural });
    } else if (item.type === 'OBJECT' && item.targetObjectMetadataId) {
      const object = objectsById.get(item.targetObjectMetadataId);
      if (object) entries.push({ ...common, type: item.type, name: object.labelPlural,
        target: `/objects/${object.namePlural}`, targetName: object.labelPlural });
    }
  }
  return { entries, owner, workspaceOrigins, rows: result.navigationMenuItems };
}

export async function listOmnichannelMenuEntries(client = new MetadataApiClient()): Promise<OmnichannelMenuEntry[]> {
  return (await readOmnichannelNavigation(client)).entries;
}

export async function renameOmnichannelMenuEntry(id: string, newName: string, client = new MetadataApiClient()): Promise<void> {
  const name = validateNavigationName(newName);
  const { entries } = await readOmnichannelNavigation(client);
  const entry = entries.find(item => item.id === id);
  if (entry?.type !== 'PAGE_LAYOUT' && entry?.type !== 'LINK') throw new Error('MENU_ENTRY_NOT_RENAMABLE');
  const { updateNavigationMenuItem: updated } = await client.mutation({
    updateNavigationMenuItem: { __args: { input: { id, update: { name } } }, id: true, name: true },
  });
  if (updated?.id !== id || updated.name !== name) throw new Error('UPDATE_NOT_CONFIRMED');
}

export async function createOmnichannelMenuAlias(id: string, newName: string, client = new MetadataApiClient()): Promise<void> {
  const name = validateNavigationName(newName);
  const { entries, owner, rows, workspaceOrigins } = await readOmnichannelNavigation(client);
  const entry = entries.find(item => item.id === id);
  if (entry?.type !== 'VIEW' && entry?.type !== 'OBJECT') throw new Error('MENU_ENTRY_NOT_ALIASABLE');

  const siblings = rows.filter(item => item.userWorkspaceId === null && (item.folderId ?? null) === entry.folderId);
  if (siblings.some(item => item.type === 'LINK' && item.link && menuDestination(item.link, workspaceOrigins) === entry.target)) {
    throw new Error('MENU_ALIAS_ALREADY_EXISTS');
  }
  const position = siblings.reduce((highest, item) => Math.max(highest, item.position), -1) + 1;
  const { createNavigationMenuItem: alias } = await client.mutation({
    createNavigationMenuItem: {
      __args: { input: { name, link: entry.target, type: 'LINK', folderId: entry.folderId,
        icon: entry.icon ?? 'IconLink', position, userWorkspaceId: null } },
      id: true, name: true, link: true, type: true, folderId: true, applicationId: true, userWorkspaceId: true,
    },
  });
  if (!alias?.id || alias.name !== name || alias.link !== entry.target || alias.type !== 'LINK' ||
    alias.applicationId !== owner || alias.userWorkspaceId !== null || (alias.folderId ?? null) !== entry.folderId) {
    throw new Error('PUBLISH_NOT_CONFIRMED');
  }
}
