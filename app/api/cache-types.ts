export interface NormalizedUser {
  username: string;
  name: string;
  webUrl: string;
  bot: boolean;
  avatarUrl: string | null;
}

export interface NormalizedIssue {
  webUrl: string;
  title: string;
  state: string;
  timeEstimate: number;
  labels: string[];
  createdAt: string;
}

export interface NormalizedTimelog {
  id: string;
  spentAt: string;
  timeSpent: number;
  username: string;
  issueUrl: string;
  sprintNumber?: number;
}

export interface NormalizedMergeRequest {
  id: string;
  title: string;
  state: string;
  webUrl: string;
  createdAt: string;
  mergedAt: string | null;
  username: string;
  approvedBy: string[];
  discussionAuthors: string[];
  discussionCount: number;
  headPipelineStatus: string | null;
  sourceBranch: string;
  targetBranch: string;
  protectedBranches: string[];
}

export interface GroupCacheEntry {
  memberUsernames: string[] | null;
  verifiedMemberUsernames: string[] | null;
  membersTimestamp: number;
  membersPromise: Promise<string[]> | null;

  timelogIds: string[] | null;
  timelogsTimestamp: number;
  timelogsPromise: Promise<string[]> | null;

  labels: any | null;
  labelsTimestamp: number;
  labelsPromise: Promise<any> | null;

  mergeRequestIds: string[] | null;
  mergeRequestsTimestamp: number;
  mergeRequestsPromise: Promise<string[]> | null;
}

export type DescendantGroup = {
  fullPath: string;
  name: string;
  id: string;
  url: string;
};
