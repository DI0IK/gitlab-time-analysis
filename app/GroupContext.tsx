import React from "react";
import { GroupMembersResponse } from "./api/group/[id]/members/route";
import { GroupLabelsResponse } from "./api/group/[id]/labels/route";
import { GroupTimelogsResponse } from "./api/group/[id]/timelogs/route";
import { GroupSprintsResponse } from "./api/group/[id]/sprints/route";

export type GroupContextType = {
  members: GroupMembersResponse;
  labels: GroupLabelsResponse;
  timelogs: GroupTimelogsResponse;
  sprints: GroupSprintsResponse;
  groupId: string;
  loaded: boolean;
};

export const GroupContext = React.createContext<GroupContextType>({
  members: [],
  labels: {},
  timelogs: [],
  sprints: [],
  groupId: "",
  loaded: false,
});
