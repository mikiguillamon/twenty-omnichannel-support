import { MetadataApiClient } from 'twenty-client-sdk/metadata';

export async function findStandalonePageLayoutId(
  universalIdentifier: string,
  client = new MetadataApiClient(),
): Promise<string | null> {
  const { getPageLayouts } = await client.query({
    getPageLayouts: {
      __args: { pageLayoutType: 'STANDALONE_PAGE' },
      id: true,
      universalIdentifier: true,
    },
  });
  return getPageLayouts.find(layout => layout.universalIdentifier === universalIdentifier)?.id ?? null;
}

export async function canManageApplications(client = new MetadataApiClient()): Promise<boolean> {
  const { currentUser } = await client.query({
    currentUser: { currentUserWorkspace: { permissionFlags: true } },
  });
  return currentUser.currentUserWorkspace?.permissionFlags?.includes('APPLICATIONS') ?? false;
}
