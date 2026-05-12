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
import TimePerCategory from "../components/TimePerCategory";
import TimePerMember from "../components/TimePerMember";
import TimePerSprintMember from "../components/TimePerSprintMember";
import TimePerWeek from "../components/TimePerWeek";
import TimePerWeekday from "../components/TimePerWeekday";
import { GroupContext } from "../GroupContext";

export default function GroupPage() {
  const { groupId } = useParams();

  const [members, setMembers] = React.useState<GroupMembersResponse>([]);
  React.useEffect(() => {
    const fetchMembers = async () => {
      const response = await fetch(`/api/group/${groupId}/members`);
      const data = await response.json();
      setMembers(data);
    };
    fetchMembers();
  }, [groupId]);

  const [labels, setLabels] = React.useState<GroupLabelsResponse>({});
  React.useEffect(() => {
    const fetchLabels = async () => {
      const response = await fetch(`/api/group/${groupId}/labels`);
      const data = await response.json();
      setLabels(data);
    };
    fetchLabels();
  }, [groupId]);

  const [timelogs, setTimelogs] = React.useState<GroupTimelogsResponse>([]);
  React.useEffect(() => {
    const fetchTimelogs = async () => {
      const response = await fetch(`/api/group/${groupId}/timelogs`);
      const data = await response.json();
      setTimelogs(data);
    };
    fetchTimelogs();
  }, [groupId]);

  const [sprints, setSprints] = React.useState<GroupSprintsResponse>([]);
  React.useEffect(() => {
    const fetchSprints = async () => {
      const response = await fetch(`/api/group/${groupId}/sprints`);
      const data = await response.json();
      setSprints(data);
    };
    fetchSprints();
  }, [groupId]);

  return (
    <GroupContext.Provider
      value={{
        members,
        labels,
        timelogs,
        sprints,
        loaded: true,
        groupId: groupId?.toString() || "",
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
    </GroupContext.Provider>
  );
}
