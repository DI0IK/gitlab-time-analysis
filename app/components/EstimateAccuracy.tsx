"use client";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  ListItemText,
  MenuItem,
  Select,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import React from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  type ScatterPointItem,
  type ScatterShapeProps,
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";
import { matchLabelToCategory } from "../utils/categoryUtils";
import { CATEGORY_DEFINITIONS } from "../config/categories";
import { useThemeMode } from "../ThemeContext";
// import { getCategoryColor } from "../utils/themeColors"; // removed dynamic color handling

const PALETTE = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#ff4d4f",
  "#13c2c2",
  "#722ed1",
  "#eb2f96",
  "#faad14",
  "#52c41a",
  "#2f54eb",
  "#fa541c",
  "#a0d911",
  "#1890ff",
  "#f5222d",
];

export default function EstimateAccuracy() {
  const { timelogs } = React.useContext(GroupContext);
  const theme = useTheme();
  // colorTheme no longer needed
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  const issueMap = new Map<
    string,
    {
      estimated: number;
      actual: number;
      title: string;
      issueLabels: string[];
      issueState: string;
    }
  >();

  timelogs.forEach((log) => {
    if (!log.issueUrl) return;
    if (!issueMap.has(log.issueUrl)) {
      issueMap.set(log.issueUrl, {
        estimated: log.issueTimeEstimate,
        actual: 0,
        title: log.issueTitle,
        issueLabels: log.issueLabels,
        issueState: log.issueState,
      });
    }
    const entry = issueMap.get(log.issueUrl);
    if (entry) entry.actual += log.timeSpent;
  });

  const rawChartData = Array.from(issueMap.entries())
    .filter(([_, issue]) => issue.estimated > 0)
    .map(([url, issue]) => ({
      x: +(issue.estimated / 3600).toFixed(2),
      y: +(issue.actual / 3600).toFixed(2),
      title: issue.title,
      issueUrl: url,
      issueLabels: issue.issueLabels,
      issueState: issue.issueState,
    }))
    .filter((d) => d.x > 0 && d.y > 0);

  // Issue status filter
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const statusFilteredData = React.useMemo(() => {
    if (statusFilter === "all") return rawChartData;
    return rawChartData.filter((d) => d.issueState === statusFilter);
  }, [rawChartData, statusFilter]);

  // Assign each issue to a category based on the first matching label
  const enriched = React.useMemo(() => {
    const points = statusFilteredData.map((d) => {
      let subcategory = "Uncategorized";
      for (const label of d.issueLabels) {
        const catDef = matchLabelToCategory(label);
        if (catDef) {
          subcategory = catDef.label;
          break;
        }
      }
      return { ...d, subcategory };
    });
    return { points };
  }, [statusFilteredData]);

  // Available subcategories (the 4 categories + Uncategorized)
  const availableSubs = React.useMemo(() => {
    const set = new Set(enriched.points.map((p) => p.subcategory));
    return Array.from(set).sort((a, b) => {
      // Put known categories first, then Others
      const idxA = CATEGORY_DEFINITIONS.findIndex((d) => d.label === a);
      const idxB = CATEGORY_DEFINITIONS.findIndex((d) => d.label === b);
      return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
    });
  }, [enriched.points]);

  // Subcategory filter state
  const [selectedSubcategories, setSelectedSubcategories] = React.useState<
    string[]
  >([]);

  React.useEffect(() => {
    if (availableSubs.length > 0) {
      setSelectedSubcategories((prev) => {
        const stillValid = prev.filter((s) => availableSubs.includes(s));
        if (stillValid.length === 0) return [...availableSubs];
        const missing = availableSubs.filter((s) => !prev.includes(s));
        return missing.length > 0 ? [...stillValid, ...missing] : stillValid;
      });
    }
  }, [availableSubs.join(",")]);

  // Filter by selected subcategories
  const filteredData = enriched.points.filter((p) =>
    selectedSubcategories.includes(p.subcategory),
  );

  // Domain and regression (from filtered data)
  const { maxVal, minVal, hasRegression, slope, intercept } =
    React.useMemo(() => {
      const data = filteredData.length > 0 ? filteredData : statusFilteredData;

      if (data.length === 0)
        return {
          maxVal: 1,
          minVal: 0.5,
          hasRegression: false,
          slope: 0,
          intercept: 0,
        };

      const max = Math.max(
        ...data.map((d) => Math.max(d.x, d.y)),
        1,
      );
      const min = Math.max(
        Math.min(...data.map((d) => Math.min(d.x, d.y)), 0.5),
        0.01,
      );

      let s = 0;
      let i = 0;
      let hasReg = false;
      if (data.length >= 2) {
        const n = data.length;
        const sumX = data.reduce((a, d) => a + d.x, 0);
        const sumY = data.reduce((a, d) => a + d.y, 0);
        const sumXY = data.reduce((a, d) => a + d.x * d.y, 0);
        const sumX2 = data.reduce((a, d) => a + d.x * d.x, 0);
        const denom = n * sumX2 - sumX * sumX;
        if (denom !== 0) {
          s = (n * sumXY - sumX * sumY) / denom;
          i = (sumY - s * sumX) / n;
          hasReg = true;
        }
      }

      return {
        maxVal: max,
        minVal: min,
        hasRegression: hasReg,
        slope: s,
        intercept: i,
      };
    }, [filteredData, statusFilteredData]);

  // Reference line point arrays
  const { yEqualsXData, regLineData } = React.useMemo(() => {
    const logMin = Math.log(minVal * 0.5);
    const logMax = Math.log(maxVal * 1.5);
    const steps = 200;
    const yEq: { x: number; y: number }[] = [];
    const reg: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.exp(logMin + (logMax - logMin) * t);
      yEq.push({ x, y: x });
      if (hasRegression) {
        reg.push({ x, y: Math.max(slope * x + intercept, 0.001) });
      }
    }
    return { yEqualsXData: yEq, regLineData: reg };
  }, [minVal, maxVal, hasRegression, slope, intercept]);

  // Compute color for a subcategory
  const getColor = (sub: string) => {
    const idx = CATEGORY_DEFINITIONS.findIndex((d) => d.label === sub);
    if (idx >= 0) return PALETTE[idx % PALETTE.length];
    // other category
    return PALETTE[CATEGORY_DEFINITIONS.length % PALETTE.length];
  };

  const CustomScatterShape = (props: ScatterShapeProps) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return null;
    const sub = (payload?.subcategory as string | undefined) || "Uncategorized";
    const color = getColor(sub);
    return <circle cx={cx} cy={cy} r={4} fill={color} opacity={0.7} />;
  };

  const handleScatterClick = (data: ScatterPointItem, _index: number) => {
    const url = data.payload?.issueUrl as string | undefined;
    if (url) window.open(url, "_blank");
  };

  if (statusFilteredData.length === 0) {
    return (
      <Card>
        <CardHeader title="Estimate Accuracy" />
        <CardContent>
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            No issues with time estimates found.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const chartMargin = { top: 10, right: 30, bottom: 20, left: 55 };

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <span>Estimate Accuracy</span>
            <Select
              native
              value={statusFilter}
              onChange={(e: SelectChangeEvent<string>) =>
                setStatusFilter(e.target.value as string)
              }
              sx={{ minWidth: 100 }}
              size="small"
            >
              <option value="all">All issues</option>
              <option value="opened">Open only</option>
              <option value="closed">Closed only</option>
            </Select>
            {availableSubs.length > 1 && (
              <Select<string[]>
                multiple
                value={selectedSubcategories}
                onChange={(e: SelectChangeEvent<string[]>) =>
                  setSelectedSubcategories(
                    typeof e.target.value === "string"
                      ? e.target.value.split(",")
                      : e.target.value,
                  )
                }
                renderValue={(selected) =>
                  selected.length === availableSubs.length
                    ? "All subcategories"
                    : `${selected.length} of ${availableSubs.length}`
                }
                sx={{ minWidth: 160, maxWidth: 240 }}
                size="small"
              >
                {availableSubs.map((sub) => (
                  <MenuItem key={sub} value={sub}>
                    <Checkbox
                      checked={selectedSubcategories.includes(sub)}
                      size="small"
                    />
                    <ListItemText primary={sub} />
                  </MenuItem>
                ))}
              </Select>
            )}
          </Box>
        }
      />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        {filteredData.length === 0 ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            No issues match the selected subcategories.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                scale="log"
                dataKey="x"
                name="Estimated"
                unit="h"
                domain={[minVal * 0.8, maxVal * 1.2]}
                tickFormatter={(v: number) => `${+v.toFixed(2)}`}
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
                domain={[minVal * 0.8, maxVal * 1.2]}
                tickFormatter={(v: number) => `${+v.toFixed(2)}`}
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
                data={filteredData}
                shape={CustomScatterShape}
                name="Issues"
                legendType="none"
                onClick={handleScatterClick}
              />
              {!isSmall && <Legend />}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
