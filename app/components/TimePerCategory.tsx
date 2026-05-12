"use client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
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
import Label from "./Label";
import SelectorCard from "./PersonSelectorWrapper";

const PALETTE = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

export default function TimePerCategory() {
  const { timelogs, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <SelectorCard
      title="Time Per Category"
      options={Object.keys(labels).map((c) => ({ label: c, value: c }))}
      defaultSelected={
        Object.entries(labels).filter(([_group, groupLabels]) =>
          groupLabels.some((l) => l.title.match(/req/i)),
        )[0]?.[0] || ""
      }
      data={{
        timelogs,
        labels,
      }}
    >
      {(selectedCategory, { timelogs, labels }) => {
        if (!labels[selectedCategory]) {
          return (
            <Typography
              color="text.secondary"
              sx={{ textAlign: "center", py: 4 }}
            >
              No data available.
            </Typography>
          );
        }
        const issuesTime: Record<
          string,
          {
            used: number;
            estimated: number;
            category: string;
            issueTitle: string;
            issueLabels: string[];
          }
        > = {};
        const issuesNotEstimatedTime: Record<
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
          if (!log.issueTimeEstimate) {
            if (!issuesNotEstimatedTime[log.issueUrl]) {
              issuesNotEstimatedTime[log.issueUrl] = {
                used: 0,
                category:
                  labels[selectedCategory]?.find(
                    (lbl) =>
                      log.issueLabels.includes(
                        `${selectedCategory}::${lbl.title}`,
                      ) || lbl.title === selectedCategory,
                  )?.title || "Uncategorized",
                issueTitle: log.issueTitle,
                issueLabels: log.issueLabels,
              };
            }
            issuesNotEstimatedTime[log.issueUrl].used += log.timeSpent;
          } else {
            if (!issuesTime[log.issueUrl]) {
              issuesTime[log.issueUrl] = {
                used: 0,
                estimated: log.issueTimeEstimate,
                category:
                  labels[selectedCategory]?.find(
                    (lbl) =>
                      log.issueLabels.includes(
                        `${selectedCategory}::${lbl.title}`,
                      ) || lbl.title === selectedCategory,
                  )?.title || "Uncategorized",
                issueTitle: log.issueTitle,
                issueLabels: log.issueLabels,
              };
            }
            issuesTime[log.issueUrl].used += log.timeSpent;
          }
        });

        const data = [
          ...labels[selectedCategory],
          Object.values(issuesTime)
            .flat()
            .some((l) => l.category === "Uncategorized") ||
          Object.values(issuesNotEstimatedTime)
            .flat()
            .some((l) => l.category === "Uncategorized")
            ? { title: "Uncategorized" }
            : null,
        ]
          .filter((v) => v !== null)
          .map((lbl) => {
            const relatedIssues = Object.values(issuesTime).filter(
              (it) => it.category === lbl.title,
            );
            const usedHours =
              relatedIssues.reduce((sum, it) => sum + it.used, 0) / 3600;
            const estimatedHours =
              relatedIssues.reduce((sum, it) => sum + it.estimated, 0) / 3600;
            const relatedNotEstimatedIssues = Object.values(
              issuesNotEstimatedTime,
            ).filter((it) => it.category === lbl.title);
            const usedNotEstimatedHours =
              relatedNotEstimatedIssues.reduce((sum, it) => sum + it.used, 0) /
              3600;
            return {
              label: lbl.title,
              usedHours: +usedHours.toFixed(2),
              estimatedHours: +estimatedHours.toFixed(2),
              usedNotEstimatedHours: +usedNotEstimatedHours.toFixed(2),
            };
          });

        return (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
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
            {issuesNotEstimatedTime &&
            Object.keys(issuesNotEstimatedTime).length > 0 ? (
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
                    {Object.entries(issuesNotEstimatedTime).map(
                      ([url, data]) => {
                        return (
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
                                      .find((l) => l.id === label)?.color ||
                                    "#428fdc"
                                  }
                                />
                              ))}
                            </Box>
                          </ListItem>
                        );
                      },
                    )}
                  </List>
                </AccordionDetails>
              </Accordion>
            ) : null}
            {issuesTime &&
            Object.keys(issuesTime).filter(
              (key) => issuesTime[key].category === "Uncategorized",
            ).length +
              Object.keys(issuesNotEstimatedTime).filter(
                (key) =>
                  issuesNotEstimatedTime[key].category === "Uncategorized",
              ).length >
              0 ? (
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
                    {Object.entries(issuesTime)
                      .filter(([_, data]) => data.category === "Uncategorized")
                      .map(([url, data]) => {
                        return (
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
                                      .find((l) => l.id === label)?.color ||
                                    "#428fdc"
                                  }
                                />
                              ))}
                            </Box>
                          </ListItem>
                        );
                      })}
                    {Object.entries(issuesNotEstimatedTime)
                      .filter(([_, data]) => data.category === "Uncategorized")
                      .map(([url, data]) => {
                        return (
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
                                      .find((l) => l.id === label)?.color ||
                                    "#428fdc"
                                  }
                                />
                              ))}
                            </Box>
                          </ListItem>
                        );
                      })}
                  </List>
                </AccordionDetails>
              </Accordion>
            ) : null}
          </>
        );
      }}
    </SelectorCard>
  );
}
