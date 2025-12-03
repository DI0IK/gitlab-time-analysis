"use client";
import React from "react";
import { GroupContext } from "../GroupContext";
import { BarChart } from "@mui/x-charts";
import SelectorCard from "./PersonSelectorWrapper";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";
import Label from "./Label";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

export default function TimePerCategory() {
  const { timelogs, labels } = React.useContext(GroupContext);

  return (
    <SelectorCard
      title="Time Per Category"
      options={Object.keys(labels).map((c) => ({ label: c, value: c }))}
      defaultSelected={Object.keys(labels)[0] || ""}
      data={{
        timelogs,
        labels,
      }}
    >
      {(selectedCategory, { timelogs, labels }) => {
        if (!labels[selectedCategory]) {
          return <BarChart height={300} series={[]} xAxis={[{ data: [] }]} />;
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
                        selectedCategory + "::" + lbl.title
                      ) || lbl.title === selectedCategory
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
                        selectedCategory + "::" + lbl.title
                      ) || lbl.title === selectedCategory
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
              (it) => it.category === lbl.title
            );
            const usedHours =
              relatedIssues.reduce((sum, it) => sum + it.used, 0) / 3600;
            const estimatedHours =
              relatedIssues.reduce((sum, it) => sum + it.estimated, 0) / 3600;
            const relatedNotEstimatedIssues = Object.values(
              issuesNotEstimatedTime
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
            <BarChart
              height={300}
              series={[
                {
                  data: data.map((d) => d.usedHours),
                  label: "Used Hours",
                  barLabel: "value",
                  stack: "a",
                },
                {
                  data: data.map((d) => d.estimatedHours),
                  label: "Estimated Hours",
                  barLabel: "value",
                  stack: "b",
                },
                {
                  data: data.map((d) => d.usedNotEstimatedHours),
                  label: "Used Hours (No Estimate)",
                  barLabel: "value",
                  stack: "a",
                },
              ]}
              grid={{ horizontal: true }}
              xAxis={[
                {
                  data: [
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
                    .map((lbl) => lbl.title),
                },
              ]}
            />
            {issuesNotEstimatedTime &&
            Object.keys(issuesNotEstimatedTime).length > 0 ? (
              <>
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
                        }
                      )}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </>
            ) : null}
            {issuesTime &&
            Object.keys(issuesTime).filter(
              (key) => issuesTime[key].category === "Uncategorized"
            ).length +
              Object.keys(issuesNotEstimatedTime).filter(
                (key) =>
                  issuesNotEstimatedTime[key].category === "Uncategorized"
              ).length >
              0 ? (
              <>
                <Accordion>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel2-content"
                    id="panel2-header"
                  >
                    <Typography component="span">
                      Uncategorized Issues
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List>
                      {Object.entries(issuesTime)
                        .filter(
                          ([_, data]) => data.category === "Uncategorized"
                        )
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
                        .filter(
                          ([_, data]) => data.category === "Uncategorized"
                        )
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
              </>
            ) : null}
          </>
        );
      }}
    </SelectorCard>
  );
}
