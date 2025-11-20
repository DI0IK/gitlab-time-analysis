import React from "react";
import { GroupContext } from "../GroupContext";
import { Card, CardContent, CardHeader } from "@mui/material";

export default function HeaderCards() {
  const { members, sprints, timelogs } = React.useContext(GroupContext);

  const totalTimeSpent = timelogs.reduce(
    (total, log) => total + log.timeSpent,
    0
  );

  return (
    <Card>
      <CardHeader title="Summary" />
      <CardContent
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
          gap: 2,
        }}
      >
        <Card variant="outlined" sx={{ mb: 1, p: 1 }}>
          <CardHeader title="Total Members" />
          <CardContent>{members.length}</CardContent>
        </Card>
        <Card variant="outlined" sx={{ mb: 1, p: 1 }}>
          <CardHeader title="Total Sprints" />
          <CardContent>{sprints.length}</CardContent>
        </Card>
        <Card variant="outlined" sx={{ mb: 1, p: 1 }}>
          <CardHeader title="Total Time Spent" />
          <CardContent>{(totalTimeSpent / 3600).toFixed(2)} hours</CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
