"use client";

import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import { useParams } from "next/navigation";
import React from "react";
import { useUserAuth } from "../UserAuthContext";
import type { GroupLabelsResponse } from "../api/group/[id]/labels/route";
import type { GroupMembersResponse } from "../api/group/[id]/members/route";
import type { GroupSprintsResponse } from "../api/group/[id]/sprints/route";
import type { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import EstimateAccuracy from "../components/EstimateAccuracy";
import HeaderCards from "../components/HeaderCards";
import Heatmap from "../components/Heatmap";
import ProblemsModal from "../components/ProblemsModal";
import SprintOverview from "../components/SprintOverview";
import SprintRadar from "../components/SprintRadar";
import StaleIndicator from "../components/StaleIndicator";
import TimePerCategory from "../components/TimePerCategory";
import TimePerMember from "../components/TimePerMember";
import TimePerSprintMember from "../components/TimePerSprintMember";
import TimePerWeek from "../components/TimePerWeek";
import TimePerWeekday from "../components/TimePerWeekday";
import UserDetailModal from "../components/UserDetailModal";
import { GroupContext } from "../GroupContext";
import { useUserProfile } from "../UserProfileContext";
import { GamificationMergeRequest } from "../utils/gamification";

async function fetchJson(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers });
  const data = await res.json();
  const cacheTimestamp = Number(res.headers.get("x-cache-timestamp")) || Date.now();
  return { data, cacheTimestamp };
}

export default function GroupPage() {
  const theme = useTheme();
  const { groupId } = useParams();
  const groupIdStr = groupId?.toString() || "";
  const { token, loading: authLoading } = useUserAuth();

  const [members, setMembers] = React.useState<GroupMembersResponse>([]);
  const [labels, setLabels] = React.useState<GroupLabelsResponse>({});
  const [timelogs, setTimelogs] = React.useState<GroupTimelogsResponse>([]);
  const [sprints, setSprints] = React.useState<GroupSprintsResponse>([]);
  const [mergeRequests, setMergeRequests] = React.useState<GamificationMergeRequest[]>([]);
  const [lastFetchedAt, setLastFetchedAt] = React.useState<Record<string, number>>({});
  const [selectedSprint, setSelectedSprint] = React.useState<number | null>(null);
  const [showProblems, setShowProblems] = React.useState(false);
  const { profileUsername, closeProfile } = useUserProfile();

  const fetchAllData = React.useCallback(async () => {
    if (authLoading) return;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const [
      { data: membersData, cacheTimestamp: membersTs },
      { data: labelsData, cacheTimestamp: labelsTs },
      { data: timelogsData, cacheTimestamp: timelogsTs },
      { data: sprintsData, cacheTimestamp: sprintsTs },
      { data: mergeRequestsData, cacheTimestamp: mergeRequestsTs },
    ] = await Promise.all([
      fetchJson(`/api/group/${groupIdStr}/members`, headers),
      fetchJson(`/api/group/${groupIdStr}/labels`, headers),
      fetchJson(`/api/group/${groupIdStr}/timelogs`, headers),
      fetchJson(`/api/group/${groupIdStr}/sprints`, headers),
      fetchJson(`/api/group/${groupIdStr}/merge-requests`, headers),
    ]);
    setMembers(membersData);
    setLabels(labelsData);
    setTimelogs(timelogsData);
    setSprints(sprintsData);
    setMergeRequests(mergeRequestsData);
    setLastFetchedAt({
      members: membersTs,
      labels: labelsTs,
      timelogs: timelogsTs,
      sprints: sprintsTs,
      mergeRequests: mergeRequestsTs,
    });
  }, [groupIdStr, token, authLoading]);

  const refreshData = React.useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  React.useEffect(() => {
    if (!authLoading) {
      fetchAllData();
    }
  }, [fetchAllData, authLoading]);

  // Set default active sprint based on current date
  React.useEffect(() => {
    if (sprints.length && selectedSprint === null) {
      const today = new Date().toISOString().slice(0, 10);
      const current = sprints.find(
        (sp) => sp.startDate <= today && today <= sp.endDate
      );
      setSelectedSprint(
        current?.sprintNumber ?? sprints[sprints.length - 1]?.sprintNumber ?? null
      );
    }
  }, [sprints, selectedSprint]);

  return (
    <GroupContext.Provider
      value={{
        members,
        labels,
        timelogs,
        sprints,
        mergeRequests,
        loaded: true,
        groupId: groupIdStr,
        lastFetchedAt,
        refreshData,
        selectedSprint,
        setSelectedSprint,
      }}
    >
      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Sticky Global Cycle Selector Bar */}
        <Box
          sx={{
            position: "sticky",
            top: 64, // below the AppShell AppBar header
            zIndex: 10,
            bgcolor: theme.palette.mode === "dark" ? "rgba(9, 13, 22, 0.8)" : "rgba(248, 250, 252, 0.8)",
            backdropFilter: "blur(12px)",
            py: 2,
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              Group Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Review timesheets and category distributions across weekly cycles
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FormControl sx={{ minWidth: 240 }} size="small">
              <InputLabel id="global-cycle-select-label">Weekly Cycle</InputLabel>
              <Select
                labelId="global-cycle-select-label"
                value={selectedSprint ?? ""}
                label="Weekly Cycle"
                onChange={(e) => setSelectedSprint(Number(e.target.value))}
                sx={{
                  bgcolor: "background.paper",
                  border: "1px solid var(--border-color)",
                  borderRadius: 2,
                }}
              >
                {sprints.map((sp) => (
                  <MenuItem key={sp.sprintNumber} value={sp.sprintNumber}>
                    {`Cycle ${sp.sprintNumber} (${new Date(
                      sp.startDate,
                    ).toLocaleDateString()} - ${new Date(
                      sp.endDate,
                    ).toLocaleDateString()})`}
                  </MenuItem>
                ))}
                {timelogs
                  .reduce((years, log) => {
                    const year = new Date(log.spentAt).getFullYear();
                    if (!years.includes(year)) years.push(year);
                    return years;
                  }, [] as number[])
                  .sort((a, b) => b - a)
                  .map((year) => (
                    <MenuItem
                      key={10000 + year}
                      value={10000 + year}
                    >{`Year ${year}`}</MenuItem>
                  ))}
                <MenuItem key={1000} value={1000}>
                  All time
                </MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Problems Board" placement="bottom">
              <IconButton
                id="problems-board-button"
                aria-label="Open problems board"
                onClick={() => setShowProblems(true)}
                size="small"
                sx={{
                  color: "warning.main",
                  border: "1px solid",
                  borderColor: "warning.main",
                  borderRadius: 1.5,
                  p: 0.75,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: "warning.main",
                    color: "#fff",
                    boxShadow: "0 0 8px rgba(255,152,0,0.4)",
                  },
                }}
              >
                <ReportProblemIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 12-Column Responsive Dashboard Grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
            gap: 3,
          }}
        >
          {/* Row 1: Summary Cards (Full Width) */}
          <Box sx={{ gridColumn: { xs: "span 12" } }}>
            <HeaderCards />
          </Box>

          {/* Row 2: Heatmap (8 columns) + SprintRadar (4 columns) */}
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 8" }, height: { xs: "auto", md: 480 } }}>
            <Heatmap />
          </Box>
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 4" }, height: { xs: "auto", md: 480 } }}>
            <SprintRadar />
          </Box>

          {/* Row 3: Cycle Overview Workspace (Full Width) */}
          <Box sx={{ gridColumn: { xs: "span 12" } }}>
            <SprintOverview />
          </Box>

          {/* Row 4: Member Performance (6 columns + 6 columns) */}
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 480 } }}>
            <TimePerMember />
          </Box>
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 480 } }}>
            <EstimateAccuracy />
          </Box>

          {/* Row 5: Categories & Sprint Members (6 columns + 6 columns) */}
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 420 } }}>
            <TimePerCategory />
          </Box>
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 420 } }}>
            <TimePerSprintMember />
          </Box>

          {/* Row 6: Temporal Trends (6 columns + 6 columns) */}
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 420 } }}>
            <TimePerWeek />
          </Box>
          <Box sx={{ gridColumn: { xs: "span 12", md: "span 6" }, height: { xs: "auto", md: 420 } }}>
            <TimePerWeekday />
          </Box>
        </Box>
      </Box>
      <StaleIndicator />
      <ProblemsModal
        open={showProblems}
        onClose={() => setShowProblems(false)}
        groupId={groupIdStr}
      />
    </GroupContext.Provider>
  );
}
