import React from "react";
import { GroupContext } from "../GroupContext";
import { Card, CardContent, CardHeader } from "@mui/material";

export default function HeaderCards() {
  const { members, sprints, timelogs } = React.useContext(GroupContext);

  const totalTimeSpent = timelogs.reduce(
    (total, log) => total + log.timeSpent,
    0
  );

  const now = new Date().getTime();

  const totalSprints = sprints.filter(
    (sprint) => new Date(sprint.endDate).getTime() <= now
  ).length;

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
          <CardHeader title="Total Members" />
          <CardContent
            sx={{ textAlign: "right", fontWeight: "bold", fontSize: 18 }}
          >
            {members.filter((m) => !m.bot).length}
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
      </CardContent>
    </Card>
  );
}
