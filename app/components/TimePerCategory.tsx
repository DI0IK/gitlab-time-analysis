"use client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";
import { matchLabelToCategory } from "../utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "../config/categories";
import Label from "./Label";

const PALETTE = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

export default function TimePerCategory() {
  const { timelogs, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  // Assign each issue to a category based on the first matching label
  const issuesWithEstimate: Record<
    string,
    {
      used: number;
      estimated: number;
      category: string;
      issueTitle: string;
      issueLabels: string[];
    }
  > = {};
  const issuesNoEstimate: Record<
    string,
    {
      used: number;
      category: string;
      issueTitle: string;
      issueLabels?: string[];
    }
  > = {};

  timelogs.forEach((log) => {
    if (!log.issueUrl) {
      console.warn("Timelog without issueUrl:", log);
      return;
    }
    // Determine category from the first matching label
    let category = "Other";
    for (const label of log.issueLabels) {
      const catDef = matchLabelToCategory(label);
      if (catDef) {
        category = catDef.label;
        break;
      }
    }

    if (!log.issueTimeEstimate) {
      if (!issuesNoEstimate[log.issueUrl]) {
        issuesNoEstimate[log.issueUrl] = {
          used: 0,
          category,
          issueTitle: log.issueTitle,
          issueLabels: log.issueLabels,
        };
      }
      issuesNoEstimate[log.issueUrl].used += log.timeSpent;
    } else {
      if (!issuesWithEstimate[log.issueUrl]) {
        issuesWithEstimate[log.issueUrl] = {
          used: 0,
          estimated: log.issueTimeEstimate,
          category,
          issueTitle: log.issueTitle,
          issueLabels: log.issueLabels,
        };
      }
      issuesWithEstimate[log.issueUrl].used += log.timeSpent;
    }
  });

  // Build chart data: one bar per category + Other
  const categoryKeys = [
    ...CATEGORY_DEFINITIONS.map((d) => d.label),
    "Other",
  ];
  const data = categoryKeys.map((key) => {
    const relatedIssues = Object.values(issuesWithEstimate).filter(
      (it) => it.category === key,
    );
    const relatedNoEst = Object.values(issuesNoEstimate).filter(
      (it) => it.category === key,
    );
    return {
      label: key,
      usedHours: +(
        relatedIssues.reduce((sum, it) => sum + it.used, 0) / 3600
      ).toFixed(2),
      estimatedHours: +(
        relatedIssues.reduce((sum, it) => sum + it.estimated, 0) / 3600
      ).toFixed(2),
      usedNotEstimatedHours: +(
        relatedNoEst.reduce((sum, it) => sum + it.used, 0) / 3600
      ).toFixed(2),
    };
  });
  const chartData = data.filter(
    (d) =>
      d.label !== "Other" ||
      d.usedHours > 0 ||
      d.estimatedHours > 0 ||
      d.usedNotEstimatedHours > 0,
  );

  const hasNoEstimate = Object.keys(issuesNoEstimate).length > 0;
  const otherIssuesWithEst = Object.values(issuesWithEstimate).filter(
    (i) => i.category === "Other",
  ).length;
  const otherIssuesNoEst = Object.values(issuesNoEstimate).filter(
    (i) => i.category === "Other",
  ).length;
  const hasOther = otherIssuesWithEst + otherIssuesNoEst > 0;

  return (
    <Card>
      <CardHeader title="Hours by Category" />
      <CardContent>
      {chartData.length === 0 || chartData.every((d) => d.usedHours === 0 && d.estimatedHours === 0 && d.usedNotEstimatedHours === 0) ? (
        <Typography
          color="text.secondary"
          sx={{ textAlign: "center", py: 4 }}
        >
          No data available.
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={true}
              vertical={false}
              opacity={0.3}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 11 }}
              height={40}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.75)" }}
              label={{ value: "Hours", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.9)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(30, 30, 30, 0.95)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 8,
                color: "#fff",
                fontSize: 13,
              }}
            />
            {!isSmall && <Legend verticalAlign="top" height={36} />}
            <Bar
              dataKey="usedHours"
              stackId="a"
              fill={PALETTE[0]}
              name="Used Hours"
            />
            <Bar
              dataKey="estimatedHours"
              stackId="b"
              fill={PALETTE[1]}
              name="Estimated Hours"
            />
            <Bar
              dataKey="usedNotEstimatedHours"
              stackId="a"
              fill={PALETTE[2]}
              name="Used Hours (No Estimate)"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
      {hasNoEstimate ? (
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1-content"
            id="panel1-header"
          >
            <Typography component="span">
              Issues without Time Estimate
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {Object.entries(issuesNoEstimate).map(([url, data]) => (
                <ListItem
                  key={url}
                  component="a"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <ListItemText
                    primary={data.issueTitle}
                    secondary={data.category}
                  />
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      mt: 0.5,
                    }}
                  >
                    {(data.issueLabels || []).map((label) => (
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
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ) : null}
      {hasOther ? (
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel2-content"
            id="panel2-header"
          >
            <Typography component="span">Uncategorized Issues</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <List>
              {Object.entries(issuesWithEstimate)
                .filter(([_, data]) => data.category === "Other")
                .map(([url, data]) => (
                  <ListItem
                    key={url}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ListItemText primary={data.issueTitle} />
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        mt: 0.5,
                      }}
                    >
                      {(data.issueLabels || []).map((label) => (
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
                  </ListItem>
                ))}
              {Object.entries(issuesNoEstimate)
                .filter(([_, data]) => data.category === "Other")
                .map(([url, data]) => (
                  <ListItem
                    key={url}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ListItemText primary={data.issueTitle} />
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        mt: 0.5,
                      }}
                    >
                      {(data.issueLabels || []).map((label) => (
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
                  </ListItem>
                ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ) : null}
      </CardContent>
    </Card>
  );
}
