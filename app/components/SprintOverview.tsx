"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import Box from "@mui/material/Box";
import {
  Card,
  CardContent,
  CardHeader,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Accordion,
  AccordionSummary,
  Typography,
  AccordionDetails,
  useMediaQuery,
  useTheme,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { GroupLabelsResponse } from "../api/group/[id]/labels/route";
import { GroupTimelogsResponse } from "../api/group/[id]/timelogs/route";
import Label from "./Label";
import { UserAvatar } from "./UserAvatar";
import ShareIcon from "@mui/icons-material/Share";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";


export default function SprintOverview() {
  const { sprints, timelogs, members, labels, groupId } =
    React.useContext(GroupContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const [selectedSprint, setSelectedSprint] = React.useState<number | null>(
    sprints.find(
      (sp) =>
        sp.startDate <= new Date().toISOString().slice(0, 10) &&
        new Date().toISOString().slice(0, 10) <= sp.endDate,
    )?.sprintNumber ?? null,
  );

  const availableGroups = Object.keys(labels || {});
  const [selectedLabelGroup, setSelectedLabelGroup] = React.useState<
    string | null
  >(availableGroups[0] ?? null);

  const [hideZeroColumns, setHideZeroColumns] = React.useState(false);

  React.useEffect(() => {
    if (availableGroups.length && !selectedLabelGroup) {
      const labelGroup =
        Object.entries(labels).filter(([group, groupLabels]) =>
          groupLabels.some((l) => l.title.match(/req/i)),
        )[0]?.[0] || "";
      if (availableGroups.includes(labelGroup)) {
        setSelectedLabelGroup(labelGroup);
      }
    }
  }, [availableGroups, labels, selectedLabelGroup]);

  React.useEffect(() => {
    if (sprints.length && selectedSprint === null) {
      setSelectedSprint(
        sprints.find(
          (sp) =>
            sp.startDate <= new Date().toISOString().slice(0, 10) &&
            new Date().toISOString().slice(0, 10) <= sp.endDate,
        )?.sprintNumber ?? null,
      );
    }
  }, [sprints, selectedSprint]);

  // Determine columns: if a label group is selected, show its label titles as columns
  const labelColumns: string[] = selectedLabelGroup
    ? (labels[selectedLabelGroup] || ([] as GroupLabelsResponse[string])).map(
        (l) => l.title,
      )
    : Object.keys(labels || {});

  // Ensure Ungrouped column exists for items without a matching label
  if (!labelColumns.includes("Ungrouped")) labelColumns.push("Ungrouped");

  // Build a map: memberId -> column -> timeSpent (seconds)
  const tableData: Record<string, Record<string, number>> = {};

  members
    .filter((m) => !m.bot)
    .forEach((m) => {
      tableData[m.id] = {};
      labelColumns.forEach((c) => {
        tableData[m.id][c] = 0;
      });
      tableData[m.id]["__sum"] = 0;
    });

  // Helper: determine if a timelog belongs to the selected sprint
  const inSelectedSprint = (log: GroupTimelogsResponse[number]) =>
    log.sprintNumber === selectedSprint ||
    selectedSprint === 1000 ||
    (selectedSprint &&
      selectedSprint >= 10000 &&
      log.spentAt.startsWith((selectedSprint - 10000).toString()));

  timelogs.forEach((logRaw) => {
    const log = logRaw as GroupTimelogsResponse[number];
    if (!inSelectedSprint(log)) return;
    const memberId = log.username || "unknown";
    if (!tableData[memberId]) {
      // ensure unknown members are present
      tableData[memberId] = {};
      labelColumns.forEach((c) => {
        tableData[memberId][c] = 0;
      });
      tableData[memberId]["__sum"] = 0;
    }

    let assignedColumn = "Ungrouped";
    if (selectedLabelGroup) {
      // find the first label in the timelog that belongs to the selected group
      const match = (log.issueLabels || []).find((il: string) =>
        il.startsWith(selectedLabelGroup + "::"),
      );
      if (match) {
        assignedColumn = match.split("::").slice(1).join("::") || "Ungrouped";
      }
    } else {
      // if no specific group selected, place into 'Ungrouped' (shouldn't happen because select defaults)
      assignedColumn = "Ungrouped";
    }

    if (!tableData[memberId][assignedColumn])
      tableData[memberId][assignedColumn] = 0;
    tableData[memberId][assignedColumn] += log.timeSpent;
    tableData[memberId]["__sum"] += log.timeSpent;
  });

  // Column sums
  const columnSums: Record<string, number> = {};
  labelColumns.forEach((g) => {
    columnSums[g] = 0;
  });
  columnSums["__sum"] = 0;

  Object.values(tableData).forEach((groupMap) => {
    labelColumns.forEach((g) => {
      columnSums[g] = (columnSums[g] || 0) + (groupMap[g] || 0);
    });
    columnSums["__sum"] += groupMap["__sum"] || 0;
  });

  if (columnSums["Ungrouped"] === 0) {
    // Remove Ungrouped column if empty
    const index = labelColumns.indexOf("Ungrouped");
    if (index > -1) {
      labelColumns.splice(index, 1);
      delete columnSums["Ungrouped"];
      Object.keys(tableData).forEach((memberId) => {
        delete tableData[memberId]["Ungrouped"];
      });
    }
  }

  // Filter out columns with 0 total hours to reduce clutter (based on toggle)
  const visibleColumns = hideZeroColumns
    ? labelColumns.filter((col) => columnSums[col] > 0)
    : labelColumns;

  const sprintIssues = React.useMemo(() => {
    if (selectedSprint === null) return {};
    if (selectedSprint === 1000) {
      const issuesMap: Record<
        string,
        { title: string; url: string; timelogs: GroupTimelogsResponse }
      > = {};
      timelogs.forEach((log) => {
        if (!issuesMap[log.issueUrl]) {
          issuesMap[log.issueUrl] = {
            title: log.issueTitle,
            url: log.issueUrl,
            timelogs: [],
          };
        }
        issuesMap[log.issueUrl].timelogs.push(log);
      });
      return issuesMap;
    }
    const timelogsInSprint = timelogs.filter(
      (log) => log.sprintNumber === selectedSprint,
    ) as GroupTimelogsResponse;
    const issuesMap: Record<
      string,
      { title: string; url: string; timelogs: GroupTimelogsResponse }
    > = {};
    timelogsInSprint.forEach((log) => {
      if (!issuesMap[log.issueUrl]) {
        issuesMap[log.issueUrl] = {
          title: log.issueTitle,
          url: log.issueUrl,
          timelogs: [],
        };
      }
      issuesMap[log.issueUrl].timelogs.push(log);
    });
    return issuesMap;
  }, [timelogs, selectedSprint]);

  return (
    <Card>
      <CardHeader title="Sprint overview" />
       <CardContent sx={{ overflowX: "auto" }}>
         <Box sx={{ display: "flex", gap: 2, alignItems: isMobile ? "stretch" : "center", mb: 2, flexWrap: isMobile ? "wrap" : "nowrap" }}>
           <FormControl sx={{ minWidth: isMobile ? "100%" : 220, flex: isMobile ? 1 : "auto" }} size="small">
             <InputLabel id="sprint-select-label">Sprint</InputLabel>
             <Select
               labelId="sprint-select-label"
               value={selectedSprint ?? ""}
               label="Sprint"
               onChange={(e) => setSelectedSprint(Number(e.target.value))}
             >
               {sprints.map((sp) => (
                 <MenuItem key={sp.sprintNumber} value={sp.sprintNumber}>
                   {`Sprint ${sp.sprintNumber} (${new Date(
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
           <FormControl sx={{ minWidth: isMobile ? "100%" : 220, flex: isMobile ? 1 : "auto" }} size="small">
             <InputLabel id="split-select-label">Split by</InputLabel>
             <Select
               labelId="split-select-label"
               value={selectedLabelGroup ?? ""}
               label="Split by"
               onChange={(e) => setSelectedLabelGroup(e.target.value as string)}
             >
               {availableGroups.map((g: string) => (
                 <MenuItem key={g} value={g}>
                   {g}
                 </MenuItem>
               ))}
             </Select>
           </FormControl>
           {!isMobile && (
             <IconButton
               size="small"
               href={`/api/group/${groupId}/table.svg?sprintNumber=${selectedSprint}&labelGroup=${selectedLabelGroup}`}
               aria-label="Link to SVG"
             >
               <ShareIcon />
             </IconButton>
           )}
           <FormControlLabel
             control={
               <Switch
                 checked={hideZeroColumns}
                 onChange={(e) => setHideZeroColumns(e.target.checked)}
               />
             }
             label={isMobile ? "Hide 0h" : "Hide zero-hour columns"}
             sx={{ ml: isMobile ? 0 : "auto", whiteSpace: "nowrap" }}
           />
         </Box>

         {isMobile ? (
           // Mobile card-based layout
           <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
             {Object.keys(tableData).map((memberId) => {
               const member = members.find((m) => m.id === memberId);
               const memberTotal = (tableData[memberId]["__sum"] || 0) / 3600;
               
               // Skip members with 0 time on mobile
               if (memberTotal === 0) return null;
               
               return (
                 <Card key={memberId} sx={{ p: 1.5, backgroundColor: "rgba(255, 255, 255, 0.05)" }}>
                   <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                     {member && (
                       <UserAvatar member={member} size="small" showTooltip={false} />
                     )}
                     <Typography sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                       {member ? member.name : memberId}
                     </Typography>
                     <Typography sx={{ ml: "auto", fontWeight: 600, fontSize: "0.9rem" }}>
                       {memberTotal.toFixed(1)}h
                     </Typography>
                   </Box>
                   <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                     {visibleColumns.map((col) => (
                       <Box key={col}>
                         <Typography sx={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.6)" }}>
                           {col}
                         </Typography>
                         <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                           {((tableData[memberId][col] || 0) / 3600).toFixed(1)}h
                         </Typography>
                       </Box>
                     ))}
                   </Box>
                 </Card>
               );
             })}
             {/* Mobile totals card */}
             <Card sx={{ p: 1.5, backgroundColor: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
               <Typography sx={{ fontWeight: 700, fontSize: "0.95rem", mb: 1 }}>
                 Total
               </Typography>
               <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                 {visibleColumns.map((col) => (
                   <Box key={col}>
                     <Typography sx={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.6)" }}>
                       {col}
                     </Typography>
                     <Typography sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                       {(columnSums[col] / 3600).toFixed(1)}h
                     </Typography>
                   </Box>
                 ))}
               </Box>
             </Card>
           </Box>
         ) : (
           // Desktop/tablet table layout
           <Table size="small">
             <TableHead>
               <TableRow>
                 <TableCell />
                 {visibleColumns.map((g: string) => (
                   <TableCell key={g} align="right">
                     {g}
                   </TableCell>
                 ))}
                 <TableCell align="right">Sum (hrs)</TableCell>
               </TableRow>
             </TableHead>
             <TableBody>
               {Object.keys(tableData).map((memberId) => {
                 const member = members.find((m) => m.id === memberId);
                 return (
                   <TableRow key={memberId}>
                     <TableCell>
                       <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                         {member && (
                           <UserAvatar member={member} size="small" showTooltip={false} />
                         )}
                         <span>{member ? member.name : memberId}</span>
                       </Box>
                     </TableCell>
                     {visibleColumns.map((g: string) => (
                       <TableCell key={g} align="right">
                         {((tableData[memberId][g] || 0) / 3600).toFixed(2)}
                       </TableCell>
                     ))}
                     <TableCell align="right">
                       {((tableData[memberId]["__sum"] || 0) / 3600).toFixed(2)}
                     </TableCell>
                   </TableRow>
                 );
               })}

               {/* Totals row */}
               <TableRow>
                 <TableCell style={{ fontWeight: "bold" }}>Total</TableCell>
                 {visibleColumns.map((g: string) => (
                   <TableCell key={g} align="right" style={{ fontWeight: "bold" }}>
                     {(columnSums[g] / 3600).toFixed(2)}
                   </TableCell>
                 ))}
                 <TableCell align="right" style={{ fontWeight: "bold" }}>
                   {(columnSums["__sum"] / 3600).toFixed(2)}
                 </TableCell>
               </TableRow>
             </TableBody>
           </Table>
         )}

        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span">Issues</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {selectedSprint !== null ? (
                Object.values(sprintIssues).map((issue) => {
                  const logged = issue.timelogs.reduce(
                    (sum, log) => sum + log.timeSpent,
                    0,
                  );
                  const loggedTotal = timelogs.reduce(
                    (sum, log) =>
                      log.issueUrl === issue.url ? sum + log.timeSpent : sum,
                    0,
                  );
                  const estimate = issue.timelogs[0]?.issueTimeEstimate || 0;
                  const deviationPercent =
                    estimate > 0
                      ? (((loggedTotal - estimate) / estimate) * 100).toFixed(2)
                      : "N/A";

                  return (
                    <Card
                      key={issue.url}
                      component="a"
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        mb: 1,
                        p: 1.5,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          boxShadow: 2,
                          transform: "translateY(-2px)",
                          backgroundColor: "rgba(255, 255, 255, 0.02)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        {/* Title and Workers Row */}
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography
                            sx={{
                              fontSize: "0.95rem",
                              fontWeight: 600,
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {issue.title}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 0.25, alignItems: "center" }}>
                            {(() => {
                              // Get unique users who worked on this issue
                              const usersOnIssue = [
                                ...new Set(issue.timelogs.map((log) => log.username)),
                              ];
                              return usersOnIssue.slice(0, 4).map((username) => {
                                const member = members.find(
                                  (m) => m.id === username
                                );
                                return member ? (
                                  <UserAvatar
                                    key={username}
                                    member={member}
                                    size="small"
                                    showTooltip={true}
                                    sx={{ width: 20, height: 20 }}
                                  />
                                ) : null;
                              });
                            })()}
                          </Box>
                        </Box>

                         {/* Time and Deviation Row */}
                         <Box
                           sx={{
                             display: "grid",
                             gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr",
                             gap: 1,
                             fontSize: "0.8rem",
                             color: "rgba(255, 255, 255, 0.8)",
                           }}
                         >
                           <Box>
                             <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.7rem" }}>Sprint</span>
                             <div style={{ fontWeight: 600 }}>
                               {(logged / 3600).toFixed(1)}h
                             </div>
                           </Box>
                           <Box>
                             <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.7rem" }}>Total</span>
                             <div style={{ fontWeight: 600 }}>
                               {(loggedTotal / 3600).toFixed(1)}h
                             </div>
                           </Box>
                           {!isMobile && (
                             <Box>
                               <span style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.7rem" }}>Estimate</span>
                               <div style={{ fontWeight: 600 }}>
                                 {(estimate / 3600).toFixed(1)}h
                               </div>
                             </Box>
                           )}
                         </Box>

                         {/* Deviation and Labels Row */}
                         <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                           <Box sx={{ fontSize: "0.8rem" }}>
                             <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>Deviation: </span>
                             <span
                               style={{
                                 fontWeight: "bold",
                                 color:
                                   deviationPercent === "N/A"
                                     ? "rgba(255, 255, 255, 0.7)"
                                     : (() => {
                                         const deviation = Number(deviationPercent);
                                         const thresholdBad = 20;
                                         const thresholdGood = 5;
                                         let t = 0;
                                         if (Math.abs(deviation) >= thresholdBad) {
                                           t = 1;
                                         } else if (Math.abs(deviation) <= thresholdGood) {
                                           t = 0;
                                         } else {
                                           t =
                                             (Math.abs(deviation) - thresholdGood) /
                                             (thresholdBad - thresholdGood);
                                         }
                                         const green = { r: 56, g: 142, b: 60 };
                                         const red = { r: 211, g: 47, b: 47 };
                                         const colorR = Math.round(
                                           green.r + (red.r - green.r) * t
                                         );
                                         const colorG = Math.round(
                                           green.g + (red.g - green.g) * t
                                         );
                                         const colorB = Math.round(
                                           green.b + (red.b - green.b) * t
                                         );
                                         return `rgb(${colorR},${colorG},${colorB})`;
                                       })(),
                               }}
                             >
                               {deviationPercent}%
                             </span>
                           </Box>
                           <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                             {(issue.timelogs[0]?.issueLabels || []).slice(0, isMobile ? 2 : 3).map((label) => (
                               <Label
                                 key={label}
                                 name={label}
                                 color={
                                   Object.values(labels || {})
                                     .flat()
                                     .find((l) => l.id === label)?.color || "#428fdc"
                                 }
                               />
                             ))}
                           </Box>
                         </Box>
                      </Box>
                    </Card>
                  );
                })
                ) : (
                  <Box sx={{ p: 2, textAlign: "center", color: "rgba(255, 255, 255, 0.6)" }}>
                    No sprint selected
                  </Box>
                )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
