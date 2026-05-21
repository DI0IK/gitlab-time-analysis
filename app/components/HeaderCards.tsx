import React from "react";
import { GroupContext } from "../GroupContext";
import { Card, CardContent, CardHeader, Box, AvatarGroup, Tooltip } from "@mui/material";
import { UserAvatar } from "./UserAvatar";

export default function HeaderCards() {
  const { members, sprints, timelogs, labels } = React.useContext(GroupContext);

  const totalTimeSpent = timelogs.reduce(
    (total, log) => total + log.timeSpent,
    0
  );

  const now = new Date().getTime();

  const totalSprints = sprints.filter(
    (sprint) => new Date(sprint.endDate).getTime() <= now
  ).length;

  const labelGroup = React.useMemo(
    () =>
      Object.entries(labels).filter(([group, groupLabels]) =>
        groupLabels.some((l) => l.title.match(/req/i))
      )[0]?.[0] || "",
    [labels]
  );

  const getTopSubTypeForSprint = (sprint, timelogs, labelGroup) => {
    if (!sprint) return null;
  
    const start = new Date(sprint.startDate).getTime();
    const end = new Date(sprint.endDate).getTime();
    const labelTypeCount = {};
  
    timelogs.forEach((log) => {
      const logTime = new Date(log.spentAt).getTime();
      if (logTime < start || logTime > end) return;
  
      const groupLabel = log.issueLabels.find((label) =>
        label.startsWith(`${labelGroup}::`)
      );
  
      const subType = groupLabel ? groupLabel.split("::")[1] : "Ungrouped";
      labelTypeCount[subType] = (labelTypeCount[subType] || 0) + log.timeSpent;
    });
  
    let topSubType = null;
    let maxTime = 0;
  
    for (const subType in labelTypeCount) {
      if (labelTypeCount[subType] > maxTime) {
        maxTime = labelTypeCount[subType];
        topSubType = subType;
      }
    }
  
    return topSubType;
  };
  
  const focusLastSprint = React.useMemo(() => {
    if (sprints.length === 0) return null;
  
    const lastSprint = sprints
      .filter((sprint) => new Date(sprint.endDate).getTime() <= now)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
  
    return getTopSubTypeForSprint(lastSprint, timelogs, labelGroup);
  }, [sprints, timelogs, now, labelGroup]);
  
  const focusThisSprint = React.useMemo(() => {
    if (sprints.length === 0) return null;
  
    const currentSprint = sprints
      .filter((sprint) => {
        const start = new Date(sprint.startDate).getTime();
        const end = new Date(sprint.endDate).getTime();
        return start <= now && end >= now;
      })
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
  
    return getTopSubTypeForSprint(currentSprint, timelogs, labelGroup);
  }, [sprints, timelogs, now, labelGroup]);

  const humanMembers = members.filter((m) => !m.bot);
  const botMembers = members.filter((m) => m.bot);

  return (
    <Card>
      <CardHeader title="Summary" />
      <CardContent
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 2,
        }}
      >
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Team Members" />
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Box sx={{ fontSize: 18, fontWeight: "bold" }}>
                {humanMembers.length}
                {botMembers.length > 0 && (
                  <Box sx={{ fontSize: "0.875rem", fontWeight: "normal", color: "rgba(255, 255, 255, 0.7)" }}>
                    + {botMembers.length} accounts
                  </Box>
                )}
              </Box>
              <AvatarGroup
                max={8}
                sx={{
                  "& .MuiAvatar-root": {
                    width: 28,
                    height: 28,
                    fontSize: "0.7rem",
                  },
                }}
              >
                {humanMembers.map((member) => (
                  <Tooltip key={member.id} title={member.name} arrow>
                    <div>
                      <UserAvatar
                        member={member}
                        size="small"
                        showTooltip={false}
                        sx={{ width: 28, height: 28 }}
                      />
                    </div>
                  </Tooltip>
                ))}
                {botMembers.map((member) => (
                  <Tooltip key={member.id} title={`${member.name} (service account)`} arrow>
                    <div>
                      <UserAvatar
                        member={member}
                        size="small"
                        showTooltip={false}
                        sx={{ width: 28, height: 28 }}
                      />
                    </div>
                  </Tooltip>
                ))}
              </AvatarGroup>
            </Box>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Total Sprints" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {totalSprints}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Total Time Spent" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {(totalTimeSpent / 3600).toFixed(2)} hours
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Time Spent per Sprint" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {totalSprints > 0
              ? (totalTimeSpent / 3600 / totalSprints).toFixed(2) + " hours"
              : "N/A"}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Focus Last Sprint" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {focusLastSprint || "N/A"}
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ p: 1, m: 0 }}>
          <CardHeader title="Focus This Sprint" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {focusThisSprint || "N/A"}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
