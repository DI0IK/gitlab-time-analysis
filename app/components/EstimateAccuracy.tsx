"use client";
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    const d = payload[0].payload;
    return (
      <div
        style={{
          backgroundColor: "rgba(30, 30, 30, 0.95)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 13,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {d.title}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          Estimated: {d.x}h
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          Actual: {d.y}h
        </Typography>
      </div>
    );
  }
  return null;
};

export default function EstimateAccuracy() {
  const { timelogs } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  const issueMap = new Map<
    string,
    { estimated: number; actual: number; title: string }
  >();

  timelogs.forEach((log) => {
    if (!log.issueUrl) return;
    if (!issueMap.has(log.issueUrl)) {
      issueMap.set(log.issueUrl, {
        estimated: log.issueTimeEstimate,
        actual: 0,
        title: log.issueTitle,
      });
    }
    const entry = issueMap.get(log.issueUrl);
    if (entry) entry.actual += log.timeSpent;
  });

  const chartData = Array.from(issueMap.entries())
    .filter(([_, issue]) => issue.estimated > 0)
    .map(([url, issue]) => ({
      x: +(issue.estimated / 3600).toFixed(2),
      y: +(issue.actual / 3600).toFixed(2),
      title: issue.title,
      issueUrl: url,
    }));

  const maxVal = Math.max(...chartData.map((d) => Math.max(d.x, d.y)), 1);
  const minVal = Math.min(...chartData.map((d) => Math.min(d.x, d.y)), 0.5);

  // Linear regression
  let slope = 0;
  let intercept = 0;
  let hasRegression = false;
  if (chartData.length >= 2) {
    const n = chartData.length;
    const sumX = chartData.reduce((s, d) => s + d.x, 0);
    const sumY = chartData.reduce((s, d) => s + d.y, 0);
    const sumXY = chartData.reduce((s, d) => s + d.x * d.y, 0);
    const sumX2 = chartData.reduce((s, d) => s + d.x * d.x, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (denom !== 0) {
      slope = (n * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / n;
      hasRegression = true;
    }
  }

  // Generate dense point arrays for reference lines
  // Use log-spaced steps so lines render smoothly on log axes
  const steps = 200;
  const yEqualsXData: { x: number; y: number }[] = [];
  const regLineData: { x: number; y: number }[] = [];
  const logMin = Math.log(minVal * 0.5);
  const logMax = Math.log(maxVal * 1.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.exp(logMin + (logMax - logMin) * t);
    yEqualsXData.push({ x, y: x });
    if (hasRegression) {
      regLineData.push({ x, y: slope * x + intercept });
    }
  }

  return (
    <Card>
      <CardHeader title="Estimate Accuracy" />
      <CardContent>
        {chartData.length === 0 ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            No issues with time estimates found.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart
              margin={{ top: 10, right: 30, bottom: 20, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                scale="log"
                dataKey="x"
                name="Estimated"
                unit="h"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => +v.toFixed(2) + ""}
                tick={{ fill: "rgba(255,255,255,0.75)" }}
                label={{
                  value: "Estimated Hours (log)",
                  position: "bottom",
                  offset: -5,
                  fill: "rgba(255,255,255,0.9)",
                }}
              />
              <YAxis
                type="number"
                scale="log"
                dataKey="y"
                name="Actual"
                unit="h"
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => +v.toFixed(2) + ""}
                tick={{ fill: "rgba(255,255,255,0.75)" }}
                label={{
                  value: "Actual Hours (log)",
                  angle: -90,
                  position: "insideLeft",
                  fill: "rgba(255,255,255,0.9)",
                }}
              />
              <Line
                data={yEqualsXData}
                dataKey="y"
                stroke="#ff9800"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="Perfect accuracy"
              />
              {hasRegression && (
                <Line
                  data={regLineData}
                  dataKey="y"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="Trend"
                />
              )}
              <Scatter
                data={chartData}
                fill="#8884d8"
                opacity={0.7}
                name="Issues"
              />
              {!isSmall && <Legend verticalAlign="top" height={36} />}
              <Tooltip content={<CustomTooltip />} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
