"use client";

import Typography from "@mui/material/Typography";
import { useParams } from "next/navigation";
import React from "react";
import type { GroupLabelsResponse } from "../api/group/[id]/labels/route";
import type { GroupMembersResponse } from "../api/group/[id]/members/route";
import type { GroupSprintsResponse } from "../api/group/[id]/sprints/route";
import type { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import EstimateAccuracy from "../components/EstimateAccuracy";
import HeaderCards from "../components/HeaderCards";
import Heatmap from "../components/Heatmap";
import SprintOverview from "../components/SprintOverview";
import SprintRadar from "../components/SprintRadar";
import StaleIndicator from "../components/StaleIndicator";
import TimePerCategory from "../components/TimePerCategory";
import TimePerMember from "../components/TimePerMember";
import TimePerSprintMember from "../components/TimePerSprintMember";
import TimePerWeek from "../components/TimePerWeek";
import TimePerWeekday from "../components/TimePerWeekday";
import { GroupContext } from "../GroupContext";

async function fetchJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

export default function GroupPage() {
  const { groupId } = useParams();
  const groupIdStr = groupId?.toString() || "";

  const [members, setMembers] = React.useState<GroupMembersResponse>([]);
  const [labels, setLabels] = React.useState<GroupLabelsResponse>({});
  const [timelogs, setTimelogs] = React.useState<GroupTimelogsResponse>([]);
  const [sprints, setSprints] = React.useState<GroupSprintsResponse>([]);
  const [lastFetchedAt, setLastFetchedAt] = React.useState<Record<string, number>>({});

  const fetchAllData = React.useCallback(async () => {
    const [membersData, labelsData, timelogsData, sprintsData] = await Promise.all([
      fetchJson(`/api/group/${groupIdStr}/members`),
      fetchJson(`/api/group/${groupIdStr}/labels`),
      fetchJson(`/api/group/${groupIdStr}/timelogs`),
      fetchJson(`/api/group/${groupIdStr}/sprints`),
    ]);
    setMembers(membersData);
    setLabels(labelsData);
    setTimelogs(timelogsData);
    setSprints(sprintsData);
    setLastFetchedAt({
      members: Date.now(),
      labels: Date.now(),
      timelogs: Date.now(),
      sprints: Date.now(),
    });
  }, [groupIdStr]);

  const refreshData = React.useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return (
    <GroupContext.Provider
      value={{
        members,
        labels,
        timelogs,
        sprints,
        loaded: true,
        groupId: groupIdStr,
        lastFetchedAt,
        refreshData,
      }}
    >
      <div
        style={{
          width: "min(max(80svw, 500px), 100svw)",
          margin: "0 auto",
          padding: "20px",
          gap: "40px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Typography variant="h4" gutterBottom>
          Group Time Analysis
        </Typography>
        <HeaderCards />
        <Heatmap />
        <TimePerWeek />
        <TimePerSprintMember />
        <EstimateAccuracy />
        <TimePerCategory />
        <TimePerMember />
        <SprintRadar />
        <TimePerWeekday />
        <SprintOverview />
      </div>
      <StaleIndicator />
    </GroupContext.Provider>
  );
}
