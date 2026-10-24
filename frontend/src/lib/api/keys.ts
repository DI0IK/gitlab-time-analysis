export const apiKeys = {
  health: ['health'] as const,
  meta: ['meta'] as const,
  groups: ['groups'] as const,
  group: (slug: string) => ['group', slug] as const,
  comparison: ['comparison'] as const,
  leaderboard: ['leaderboard'] as const,
  workItems: (slug: string) => ['work-items', slug] as const,
  workItem: (id: string) => ['work-item', id] as const,
  repoTree: (projectPath: string, path?: string, ref?: string) =>
    ['repo-tree', projectPath, path ?? '', ref ?? ''] as const,
  mergeRequests: (slug: string) => ['merge-requests', slug] as const,
  authMe: ['auth', 'me'] as const,
  userProfile: ['user', 'profile'] as const,
}
