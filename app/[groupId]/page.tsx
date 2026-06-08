"use client";

import {
  Box,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  useTheme,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import TvIcon from "@mui/icons-material/Tv";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import Group from "@mui/icons-material/Group";
import { useParams } from "next/navigation";
import React from "react";
import { useUserAuth } from "../UserAuthContext";
import { useThemeMode } from "../ThemeContext";
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
import { GamificationMergeRequest, computeLevelInfo, computeGamification, TIER_INFO } from "../utils/gamification";
import {
  PieChart,
  Pie,
  Cell,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { matchLabelToCategory } from "../utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "../config/categories";
import { UserAvatar } from "../components/UserAvatar";

const clientCache = new Map<string, { data: any; ts: number }>();
const CLIENT_CACHE_TTL = 60000;

function clearClientCache() {
  clientCache.clear();
}

async function fetchJson(url: string, headers?: Record<string, string>) {
  const cacheKey = url;
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL) {
    return cached.data;
  }
  const res = await fetch(url, { headers });
  const data = await res.json();
  const cacheTimestamp = Number(res.headers.get("x-cache-timestamp")) || Date.now();
  const result = { data, cacheTimestamp };
  clientCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

export default function GroupPage() {
  const theme = useTheme();
  const { presentationMode, setPresentationMode } = useThemeMode();
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

  const togglePresentationMode = () => {
    if (!presentationMode) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable full-screen mode:", err);
      });
      setPresentationMode(true);
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setPresentationMode(false);
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setPresentationMode(isFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [setPresentationMode]);

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
    clearClientCache();
    fetchAllData();
  }, [fetchAllData]);

  React.useEffect(() => {
    if (!authLoading) {
      fetchAllData();
    }
  }, [fetchAllData, authLoading]);

  // Group-level XP: aggregate verified human members' gamification
  // Computed off the main thread after render to avoid blocking the UI
  const [groupLevelInfo, setGroupLevelInfo] = React.useState<{
    totalXp: number;
    avgXp: number;
    memberCount: number;
  } & ReturnType<typeof computeLevelInfo> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const humanMembers = members.filter((m) => !m.bot && m.verified);
      if (humanMembers.length === 0) return;
      const humanMemberIds = humanMembers.map((m) => m.id.toLowerCase());
      let totalXp = 0;
      let activeCount = 0;
      for (const member of humanMembers) {
        const validatedTeammates = humanMemberIds.filter((id) => id !== member.id.toLowerCase());
        const stats = computeGamification(member.id, timelogs, mergeRequests, false, validatedTeammates);
        if (stats.xp > 0) {
          totalXp += stats.xp;
          activeCount++;
        }
      }
      if (cancelled) return;
      if (activeCount === 0) return;
      const avgXp = Math.floor(totalXp / activeCount);
      const info = computeLevelInfo(avgXp);
      setGroupLevelInfo({ totalXp, avgXp, memberCount: activeCount, ...info });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [members, timelogs, mergeRequests]);

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
        {!presentationMode && (
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
        )}

        {presentationMode ? (
          /* Presentation Mode Layout - Optimized for readability, forced light mode, scroll-free fit */
          (() => {
            const currentSprintLogs = timelogs.filter((log) => {
              return (
                log.sprintNumber === selectedSprint ||
                selectedSprint === 1000 ||
                (selectedSprint &&
                  selectedSprint >= 10000 &&
                  log.spentAt.startsWith((selectedSprint - 10000).toString()))
              );
            });

            const totalCycleSeconds = currentSprintLogs.reduce((sum, log) => sum + log.timeSpent, 0);
            const totalCycleHours = (totalCycleSeconds / 3600).toFixed(1);

            // Group category data for Pie Chart
            const categoryTotals: Record<string, number> = {};
            currentSprintLogs.forEach((log) => {
              let category = "Other";
              for (const label of log.issueLabels) {
                const catDef = matchLabelToCategory(label);
                if (catDef) {
                  category = catDef.label;
                  break;
                }
              }
              categoryTotals[category] = (categoryTotals[category] || 0) + log.timeSpent;
            });

            const pieData = Object.entries(categoryTotals)
              .map(([name, value]) => ({
                name,
                value: +(value / 3600).toFixed(2),
              }))
              .filter((d) => d.value > 0);

            const PIE_COLORS = ["#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#6B7280"];

            // Group issues by total time spent with detailed metrics
            const issuesMap: Record<
              string,
              {
                title: string;
                url: string;
                timeSpent: number;
                totalTimeSpent: number;
                users: string[];
                estimate: number;
                labels: string[];
              }
            > = {};
            currentSprintLogs.forEach((log) => {
              if (!issuesMap[log.issueUrl]) {
                const totalSec = timelogs
                  .filter((t) => t.issueUrl === log.issueUrl)
                  .reduce((sum, t) => sum + t.timeSpent, 0);

                issuesMap[log.issueUrl] = {
                  title: log.issueTitle,
                  url: log.issueUrl,
                  timeSpent: 0,
                  totalTimeSpent: totalSec,
                  users: [],
                  estimate: log.issueTimeEstimate || 0,
                  labels: log.issueLabels || [],
                };
              }
              issuesMap[log.issueUrl].timeSpent += log.timeSpent;
              if (log.username && !issuesMap[log.issueUrl].users.includes(log.username.toString())) {
                issuesMap[log.issueUrl].users.push(log.username.toString());
              }
            });
            const topIssues = Object.values(issuesMap)
              .sort((a, b) => b.timeSpent - a.timeSpent);

            // Filter MRs to the current sprint by date range
            const sprintMRs = mergeRequests.filter((mr) => {
              if (selectedSprint === 1000) return true;
              const created = mr.createdAt.slice(0, 10);
              const merged = mr.mergedAt ? mr.mergedAt.slice(0, 10) : null;
              const closed = mr.closedAt ? mr.closedAt.slice(0, 10) : null;
              if (selectedSprint && selectedSprint >= 10000) {
                const yearStr = (selectedSprint - 10000).toString();
                return mr.createdAt.startsWith(yearStr) || 
                       (mr.mergedAt && mr.mergedAt.startsWith(yearStr)) ||
                       (mr.closedAt && mr.closedAt.startsWith(yearStr));
              }
              const sprint = sprints.find((sp) => sp.sprintNumber === selectedSprint);
              if (!sprint) return true;
              return created <= sprint.endDate && 
                     (merged === null || merged >= sprint.startDate) && 
                     (closed === null || closed >= sprint.startDate);
            });

            // Build Cycle Table Data
            const columns = [
              ...CATEGORY_DEFINITIONS.map((d) => ({ id: d.id, title: d.shortLabel })),
              { id: "other", title: "Other" },
            ];

            const memberTableData: Record<string, Record<string, number>> = {};
            const activeMembers = members.filter((m) => !m.bot && m.verified);
            
            activeMembers.forEach((m) => {
              memberTableData[m.id] = {};
              columns.forEach((c) => {
                memberTableData[m.id][c.id] = 0;
              });
              memberTableData[m.id]["__sum"] = 0;
            });

            currentSprintLogs.forEach((log) => {
              const memberId = log.username || "unknown";
              if (!memberTableData[memberId]) return;

              let assignedCol = "other";
              for (const label of log.issueLabels || []) {
                const catDef = matchLabelToCategory(label);
                if (catDef) {
                  assignedCol = catDef.id;
                  break;
                }
              }
              memberTableData[memberId][assignedCol] += log.timeSpent;
              memberTableData[memberId]["__sum"] += log.timeSpent;
            });

            // Compute column sums and only remove 'other' if empty
            const columnSums: Record<string, number> = {};
            columns.forEach((col) => { columnSums[col.id] = 0; });
            Object.values(memberTableData).forEach((row) => {
              columns.forEach((col) => {
                columnSums[col.id] += row[col.id];
              });
            });

            if (columnSums["other"] === 0) {
              const otherIdx = columns.findIndex((c) => c.id === "other");
              if (otherIdx > -1) {
                columns.splice(otherIdx, 1);
                delete columnSums["other"];
              }
            }
            const visibleColumns = columns;

            return (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  p: 4,
                  height: "100vh",
                  maxHeight: "100vh",
                  overflow: "hidden",
                  bgcolor: "#ffffff",
                  color: "#0f172a",
                }}
              >
                {/* Header Row: Title & Total Hours Callout + Exit button */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "2px solid #e2e8f0",
                    pb: 2,
                    flexShrink: 0,
                  }}
                >
                  <Box>
                    <Typography variant="h3" sx={{ fontWeight: 800, color: "#1e293b" }}>
                      Cycle {selectedSprint === 1000 ? "All Time" : selectedSprint} Overview
                    </Typography>
                    <Typography variant="subtitle1" sx={{ color: "#64748b", fontWeight: 500, mt: 0.5 }}>
                      Active group performance and work breakdowns
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        px: 4,
                        bgcolor: "rgba(124, 58, 237, 0.08)",
                        border: "1px solid rgba(124, 58, 237, 0.2)",
                        borderRadius: 3,
                        textAlign: "center",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Total Logged Hours
                      </Typography>
                      <Typography variant="h2" sx={{ fontWeight: 900, color: "primary.dark", mt: 0.5, lineHeight: 1 }}>
                        {totalCycleHours}h
                      </Typography>
                    </Paper>

                    <IconButton
                      onClick={togglePresentationMode}
                      sx={{
                        bgcolor: "error.main",
                        color: "#ffffff",
                        boxShadow: 2,
                        p: 2,
                        borderRadius: 3,
                        transition: "transform 0.2s ease, background-color 0.2s ease",
                        "&:hover": {
                          bgcolor: "error.dark",
                          transform: "scale(1.08)",
                        },
                      }}
                      title="Exit Presentation Mode"
                    >
                      <FullscreenExitIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                  </Box>
                </Box>

                {/* Main Content Layout (Split Vertically: Table/Pie on Top, Issues on Bottom) */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, minHeight: 0 }}>
                  
                  {/* Top Block: Table (span 8) & Category Pie Chart (span 4) */}
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, flex: "0 0 280px" }}>
                    {/* Cycle Table */}
                    <Box sx={{ gridColumn: "span 8", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3,
                          border: "1px solid #e2e8f0",
                          borderRadius: 3,
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          minHeight: 0,
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: "#334155" }}>
                          Team Timesheet Breakdown
                        </Typography>
                        <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 0 }}>
                          <Table size="medium" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 800, color: "#475569" }}>Member</TableCell>
                                {visibleColumns.map((col) => (
                                  <TableCell key={col.id} align="right" sx={{ fontWeight: 800, color: "#475569" }}>
                                    {col.title}
                                  </TableCell>
                                ))}
                                <TableCell align="right" sx={{ fontWeight: 800, color: "#475569" }}>Total (hrs)</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {activeMembers.map((member) => {
                                const sum = (memberTableData[member.id]?.["__sum"] || 0) / 3600;
                                return (
                                  <TableRow key={member.id} hover>
                                    <TableCell>
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                        <UserAvatar member={member} size="small" showTooltip={false} />
                                        <Typography sx={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>
                                          {member.name}
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                    {visibleColumns.map((col) => (
                                      <TableCell key={col.id} align="right" sx={{ fontWeight: 600, color: "#334155" }}>
                                        {((memberTableData[member.id]?.[col.id] || 0) / 3600).toFixed(1)}
                                      </TableCell>
                                    ))}
                                    <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                                      {sum.toFixed(1)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}

                              {/* Totals row */}
                              <TableRow sx={{ "& td": { fontWeight: "bold", bgcolor: "#f8fafc", borderTop: "2px solid #e2e8f0" } }}>
                                <TableCell>Total</TableCell>
                                {visibleColumns.map((col) => (
                                  <TableCell key={col.id} align="right">
                                    {((columnSums[col.id] || 0) / 3600).toFixed(1)}
                                  </TableCell>
                                ))}
                                <TableCell align="right" sx={{ color: "primary.dark" }}>
                                  {(totalCycleSeconds / 3600).toFixed(1)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </Box>
                      </Paper>
                    </Box>

                    {/* Category Pie Chart */}
                    <Box sx={{ gridColumn: "span 4", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3,
                          border: "1px solid #e2e8f0",
                          borderRadius: 3,
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          minHeight: 0,
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: "#334155" }}>
                          Category Distribution
                        </Typography>
                        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius="45%"
                                outerRadius="75%"
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip formatter={(value) => `${value}h`} />
                              <RechartsLegend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                          </ResponsiveContainer>
                        </Box>
                      </Paper>
                    </Box>
                  </Box>

                  {/* Bottom Block: Issues (left) + Merge Requests (right) */}
                  <Box sx={{ flex: "1 1 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, minHeight: 0 }}>

                    {/* LEFT: Top Issues Scrollable List */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        border: "1px solid #e2e8f0",
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        overflow: "hidden",
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: "#334155", flexShrink: 0 }}>
                        Top Issues Worked On
                        <Typography component="span" variant="body2" sx={{ ml: 1, color: "#94a3b8", fontWeight: 500 }}>
                          ({topIssues.length})
                        </Typography>
                      </Typography>
                      <Box sx={{ overflowY: "auto", flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                        {topIssues.map((issue, idx) => {
                          const loggedHours = (issue.timeSpent / 3600).toFixed(1);
                          const totalHours = (issue.totalTimeSpent / 3600).toFixed(1);
                          const estimateHours = (issue.estimate / 3600).toFixed(1);
                          const deviation = issue.estimate > 0
                            ? (((issue.totalTimeSpent - issue.estimate) / issue.estimate) * 100).toFixed(0)
                            : "N/A";

                          return (
                            <Box
                              key={issue.url}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                p: 1.25,
                                pr: 1.5,
                                borderRadius: 2,
                                bgcolor: "#f8fafc",
                                border: "1px solid #f1f5f9",
                                minWidth: 0,
                                flexShrink: 0,
                              }}
                            >
                              {/* Rank badge */}
                              <Typography
                                sx={{
                                  fontWeight: 900,
                                  color: "primary.main",
                                  fontSize: "0.85rem",
                                  minWidth: 28,
                                  textAlign: "center",
                                  flexShrink: 0,
                                }}
                              >
                                #{idx + 1}
                              </Typography>

                              {/* Title + meta */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  noWrap
                                  title={issue.title}
                                  sx={{
                                    fontWeight: 700,
                                    color: "#1e293b",
                                    fontSize: "0.9rem",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {issue.title}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 0.25 }}>
                                  <Typography component="span" sx={{ fontSize: "0.7rem", color: "#64748b" }}>
                                    Cycle: <b>{loggedHours}h</b>
                                  </Typography>
                                  <Typography component="span" sx={{ fontSize: "0.7rem", color: "#64748b" }}>
                                    Total: <b>{totalHours}h</b>
                                  </Typography>
                                  {issue.estimate > 0 && (
                                    <>
                                      <Typography component="span" sx={{ fontSize: "0.7rem", color: "#64748b" }}>
                                        Est: <b>{estimateHours}h</b>
                                      </Typography>
                                      <Typography
                                        component="span"
                                        sx={{
                                          fontSize: "0.7rem",
                                          fontWeight: 700,
                                          color: Math.abs(Number(deviation)) > 20 ? "#ef4444" : "#10b981",
                                        }}
                                      >
                                        Dev: {deviation}%
                                      </Typography>
                                    </>
                                  )}
                                </Box>
                              </Box>

                              {/* Contributor avatars */}
                              <Box sx={{ display: "flex", gap: 0.4, flexShrink: 0 }}>
                                {issue.users.slice(0, 3).map((username) => {
                                  const member = members.find((m) => m.id === username);
                                  return member ? (
                                    <UserAvatar
                                      key={username}
                                      member={member}
                                      size="medium"
                                      showTooltip={true}
                                      sx={{ width: 26, height: 26 }}
                                    />
                                  ) : null;
                                })}
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </Paper>

                    {/* RIGHT: Merge Requests Scrollable List */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        border: "1px solid #e2e8f0",
                        borderRadius: 3,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        overflow: "hidden",
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, color: "#334155", flexShrink: 0 }}>
                        Merge Requests
                        <Typography component="span" variant="body2" sx={{ ml: 1, color: "#94a3b8", fontWeight: 500 }}>
                          ({sprintMRs.length})
                        </Typography>
                      </Typography>
                      <Box sx={{ overflowY: "auto", flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                        {sprintMRs.length === 0 ? (
                          <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", mt: 4 }}>
                            No merge requests for this period
                          </Typography>
                        ) : (
                          sprintMRs.map((mr) => {
                            const stateColor =
                              mr.state === "merged" ? "#7C3AED"
                              : mr.state === "opened" ? "#10B981"
                              : "#94a3b8";
                            const stateLabel =
                              mr.state === "merged" ? "Merged"
                              : mr.state === "opened" ? "Open"
                              : "Closed";
                            const author = members.find((m) => m.id === mr.username);

                            return (
                              <Box
                                key={mr.id}
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1.5,
                                  p: 1.25,
                                  pr: 1.5,
                                  borderRadius: 2,
                                  bgcolor: "#f8fafc",
                                  border: "1px solid #f1f5f9",
                                  borderLeft: `3px solid ${stateColor}`,
                                  minWidth: 0,
                                  flexShrink: 0,
                                }}
                              >
                                {/* Author avatar */}
                                {author && (
                                  <UserAvatar
                                    member={author}
                                    size="medium"
                                    showTooltip={true}
                                    sx={{ width: 26, height: 26, flexShrink: 0 }}
                                  />
                                )}

                                {/* Title + meta */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography
                                    noWrap
                                    title={mr.title}
                                    sx={{
                                      fontWeight: 700,
                                      color: "#1e293b",
                                      fontSize: "0.9rem",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {mr.title}
                                  </Typography>
                                  <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center", mt: 0.25 }}>
                                    <Typography
                                      component="span"
                                      sx={{
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        color: stateColor,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                      }}
                                    >
                                      {stateLabel}
                                    </Typography>
                                    <Typography
                                      component="span"
                                      noWrap
                                      sx={{
                                        fontSize: "0.68rem",
                                        color: "#64748b",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        maxWidth: 140,
                                      }}
                                      title={`${mr.sourceBranch} → ${mr.targetBranch}`}
                                    >
                                      {mr.sourceBranch} → {mr.targetBranch}
                                    </Typography>
                                    {(mr.additions != null || mr.deletions != null) && (
                                      <Typography component="span" sx={{ fontSize: "0.68rem", color: "#64748b" }}>
                                        {mr.additions != null && (
                                          <span style={{ color: "#10b981", fontWeight: 700 }}>+{mr.additions}</span>
                                        )}
                                        {mr.additions != null && mr.deletions != null && " "}
                                        {mr.deletions != null && (
                                          <span style={{ color: "#ef4444", fontWeight: 700 }}>-{mr.deletions}</span>
                                        )}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>

                                {/* Approval count badge */}
                                {mr.approvedBy.length > 0 && (
                                  <Box
                                    sx={{
                                      flexShrink: 0,
                                      px: 1,
                                      py: 0.25,
                                      borderRadius: 1,
                                      bgcolor: "rgba(124, 58, 237, 0.08)",
                                      border: "1px solid rgba(124, 58, 237, 0.2)",
                                    }}
                                  >
                                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 700, color: "#7C3AED" }}>
                                      ✓ {mr.approvedBy.length}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            );
                          })
                        )}
                      </Box>
                    </Paper>

                  </Box>

                </Box>
              </Box>
            );
          })()
        ) : (
          /* Standard Responsive Dashboard Grid */
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

            {/* Row 1.5: Group Level Card (Full Width) */}
            {groupLevelInfo && (
              <Box sx={{ gridColumn: { xs: "span 12" } }}>
                <Card
                  sx={{
                    background: `linear-gradient(135deg, ${groupLevelInfo.tierColor}15, rgba(255,255,255,0.01))`,
                    border: `1px solid ${groupLevelInfo.tierColor}30`,
                  }}
                >
                  <CardContent
                    sx={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", py: 2.5, "&:last-child": { pb: 2.5 } }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: `${groupLevelInfo.tierColor}20`,
                          border: `2px solid ${groupLevelInfo.tierColor}`,
                        }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: "1.25rem", color: groupLevelInfo.tierColor, lineHeight: 1 }}>
                          {groupLevelInfo.level}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary", lineHeight: 1.2 }}>
                          Group Level
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: groupLevelInfo.tierColor, lineHeight: 1.3 }}>
                          {groupLevelInfo.tierLabel}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ flexGrow: 1, minWidth: 200, maxWidth: 500 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {groupLevelInfo.totalXp.toLocaleString()} Total XP
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.max(0, (groupLevelInfo.xpForNextLevel * groupLevelInfo.memberCount) - groupLevelInfo.totalXp).toLocaleString()} XP to Level {groupLevelInfo.level + 1}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={groupLevelInfo.xpPercent}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "rgba(255,255,255,0.08)",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 4,
                            backgroundColor: groupLevelInfo.tierColor,
                          },
                        }}
                      />
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Group sx={{ color: "text.secondary", fontSize: 20 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {groupLevelInfo.memberCount} members
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
            )}

            {/* Row 2: Heatmap (Full Width on desktop) */}
            <Box sx={{ gridColumn: { xs: "span 12" }, height: { xs: 360, md: 480 } }}>
              <Heatmap />
            </Box>

            {/* Row 3: Cycle Overview Workspace (Full Width) */}
            <Box sx={{ gridColumn: { xs: "span 12" } }}>
              <SprintOverview />
            </Box>

            {/* Row 4: Sprint Radar + Member Performance (4 + 4 + 4 columns) */}
            <Box sx={{ gridColumn: { xs: "span 12", md: "span 4" }, height: { xs: "auto", md: 480 } }}>
              <SprintRadar />
            </Box>
            <Box sx={{ gridColumn: { xs: "span 12", md: "span 4" }, height: { xs: "auto", md: 480 } }}>
              <TimePerMember />
            </Box>
            <Box sx={{ gridColumn: { xs: "span 12", md: "span 4" }, height: { xs: "auto", md: 480 } }}>
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
        )}
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
