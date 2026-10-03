import React from "react";
import {
  GroupMembersResponse,
  GroupLabelsResponse,
  GroupTimelogsResponse,
  GroupSprintsResponse,
} from "./api/group/types";
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
