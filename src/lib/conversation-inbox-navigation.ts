import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { AppPath, navigate } from 'twenty-sdk/front-component';
import { isRecordUuid, type ConversationView } from './conversation-inbox.ts';
import { validateNavigationName } from './dashboard-navigation.ts';

export const CONVERSATION_VIEW_PARAM = 'omniView';

export async function openConversationRecord(id: string, navigateRecord = navigate): Promise<void> {
  if (!isRecordUuid(id)) throw new Error('CONVERSATION_ID_INVALID');
  await navigateRecord(AppPath.RecordShowPage, { objectNameSingular: 'supportCase', objectRecordId: id }, undefined, { surface: 'main' });
}

export function readConversationViewId(search: string): string | null {
  const values = new URLSearchParams(search).getAll(CONVERSATION_VIEW_PARAM);
  return values.length === 1 && isRecordUuid(values[0]) ? values[0] : null;
}

export function conversationViewLink(pathname: string, viewId: string): string | null {
  if (!pathname.startsWith('/page/') || !isRecordUuid(pathname.slice('/page/'.length)) || !isRecordUuid(viewId)) return null;
  return `${pathname}?${CONVERSATION_VIEW_PARAM}=${viewId}`;
}

export async function publishConversationViewLink(
  pathname: string,
  view: ConversationView,
  client = new MetadataApiClient(),
  menuName = view.name,
): Promise<'created' | 'existing'> {
  const link = conversationViewLink(pathname, view.id);
  if (!link) throw new Error('CONVERSATION_VIEW_LINK_INVALID');
  const name = validateNavigationName(menuName);
  const { currentWorkspace, navigationMenuItems } = await client.query({
    currentWorkspace: { workspaceCustomApplicationId: true },
    navigationMenuItems: { type: true, link: true, position: true, userWorkspaceId: true, folderId: true },
  });
  const owner = currentWorkspace?.workspaceCustomApplicationId;
  if (!owner || !Array.isArray(navigationMenuItems)) throw new Error('CONVERSATION_MENU_UNAVAILABLE');

  if (navigationMenuItems.some(item => item.type === 'LINK' && item.link === link && item.userWorkspaceId === null)) return 'existing';
  const position = navigationMenuItems.reduce((highest, item) =>
    item.folderId === null && item.userWorkspaceId === null ? Math.max(highest, item.position) : highest, -1) + 1;

  const { createNavigationMenuItem: entry } = await client.mutation({
    createNavigationMenuItem: {
      __args: { input: { name, link, icon: 'IconInbox', type: 'LINK', position, userWorkspaceId: null } },
      id: true, type: true, link: true, applicationId: true, userWorkspaceId: true, folderId: true,
    },
  });
  if (!entry?.id || entry.type !== 'LINK' || entry.link !== link || entry.applicationId !== owner ||
      entry.userWorkspaceId !== null || entry.folderId !== null) throw new Error('CONVERSATION_MENU_DID_NOT_SAVE');
  return 'created';
}
