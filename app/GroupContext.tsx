import React from "react";
import { GroupMembersResponse } from "./api/group/[id]/members/route";
import { GroupLabelsResponse } from "./api/group/[id]/labels/route";
import { GroupTimelogsResponse } from "./api/group/[id]/timelogs/route";
import { GroupSprintsResponse } from "./api/group/[id]/sprints/route";
import { GamificationMergeRequest } from "./utils/gamification";

export type GroupContextType = {
  members: GroupMembersResponse;
  labels: GroupLabelsResponse;
  timelogs: GroupTimelogsResponse;
  sprints: GroupSprintsResponse;
  mergeRequests: GamificationMergeRequest[];
  groupId: string;
  loaded: boolean;
  lastFetchedAt: Record<string, number>;
  refreshData: () => void;
  selectedSprint: number | null;
  setSelectedSprint: (sprint: number | null) => void;
};

export const GroupContext = React.createContext<GroupContextType>({
  members: [],
  labels: {},
  timelogs: [],
  sprints: [],
  mergeRequests: [],
  groupId: "",
  loaded: false,
  lastFetchedAt: {},
  refreshData: () => {},
  selectedSprint: null,
  setSelectedSprint: () => {},
});
