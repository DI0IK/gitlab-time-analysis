export const apiKeys = {
  health: ['health'] as const,
  meta: ['meta'] as const,
  roots: ['roots'] as const,
  adminRootGroups: ['admin', 'root-groups'] as const,
  adminUsers: ['admin', 'users'] as const,
  authMe: ['auth', 'me'] as const,
  userProfile: ['user', 'profile'] as const,

  // Tenant-Scoped Query Keys
  rootGroups: (rootSlug: string) => ['root', rootSlug, 'groups'] as const,
  rootGroupMembers: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'group-members', groupSlug] as const,
  rootDashboard: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'dashboard', groupSlug] as const,
  rootActivity: (rootSlug: string, groupSlug: string, filters?: unknown) =>
    ['root', rootSlug, 'activity', groupSlug, filters] as const,
  rootLeaderboard: (rootSlug: string, groupSlug?: string) =>
    ['root', rootSlug, 'leaderboard', groupSlug ?? 'cohort'] as const,
  rootComparison: (rootSlug: string) => ['root', rootSlug, 'comparison'] as const,
  rootWorkItems: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'work-items', groupSlug] as const,
  rootMergeRequests: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'merge-requests', groupSlug] as const,
  rootRepositories: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'repositories', groupSlug] as const,
  rootWikiTargets: (rootSlug: string, groupSlug: string) =>
    ['root', rootSlug, 'wiki-targets', groupSlug] as const,
  rootUserDetails: (rootSlug: string, username: string) =>
    ['root', rootSlug, 'user-details', username] as const,
  rootNotes: (rootSlug: string, itemType: string, itemId: string) =>
    ['root', rootSlug, 'notes', itemType, itemId] as const,
  rootRepoTree: (rootSlug: string, project: string, path?: string, ref?: string) =>
    ['root', rootSlug, 'repo-tree', project, path ?? '', ref ?? ''] as const,
  rootRepoBranches: (rootSlug: string, project: string) =>
    ['root', rootSlug, 'repo-branches', project] as const,
  rootRepoBlob: (rootSlug: string, project: string, filePath: string, ref?: string) =>
    ['root', rootSlug, 'repo-blob', project, filePath, ref ?? ''] as const,
  rootRepoCommits: (rootSlug: string, project: string, path?: string, ref?: string) =>
    ['root', rootSlug, 'repo-commits', project, path ?? '', ref ?? ''] as const,
  rootWikiPages: (rootSlug: string, project: string, ref?: string) =>
    ['root', rootSlug, 'wiki-pages', project, ref ?? ''] as const,
  rootWikiPage: (rootSlug: string, project: string, slug: string, ref?: string) =>
    ['root', rootSlug, 'wiki-page', project, slug, ref ?? ''] as const,
  rootWikiHistory: (rootSlug: string, project: string, slug?: string) =>
    ['root', rootSlug, 'wiki-history', project, slug ?? ''] as const,
}
