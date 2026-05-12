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
  XAxis,
  YAxis,
} from "recharts";
import { GroupContext } from "../GroupContext";

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
  const { timelogs, labels } = React.useContext(GroupContext);
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  const issueMap = new Map<
    string,
    { estimated: number; actual: number; title: string; issueLabels: string[] }
  >();

  timelogs.forEach((log) => {
    if (!log.issueUrl) return;
    if (!issueMap.has(log.issueUrl)) {
      issueMap.set(log.issueUrl, {
        estimated: log.issueTimeEstimate,
        actual: 0,
        title: log.issueTitle,
        issueLabels: log.issueLabels,
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
    }))
    .filter((d) => d.x > 0 && d.y > 0);

  // Parent category selector state
  const categoryOptions = Object.keys(labels).map((c) => ({
    label: c,
    value: c,
  }));

  const defaultCategory =
    Object.entries(labels).filter(([_group, groupLabels]) =>
      groupLabels.some((l) => l.title.match(/req/i)),
    )[0]?.[0] ||
    categoryOptions[0]?.value ||
    "";

  const [selectedCategory, setSelectedCategory] =
    React.useState<string>(defaultCategory);

  React.useEffect(() => {
    setSelectedCategory(defaultCategory);
  }, [defaultCategory]);

  // Enrich chart data with subcategory and build color map
  const enriched = React.useMemo(() => {
    if (!labels[selectedCategory] || rawChartData.length === 0)
      return { points: [] as RawPoint[], labelColorMap: new Map<string, string>() };

    const labelColorMap = new Map<string, string>();
    for (const lbl of labels[selectedCategory]) {
      labelColorMap.set(`${selectedCategory}::${lbl.title}`, lbl.color);
    }

    const points = rawChartData.map((d) => {
      const matchedLabel = d.issueLabels.find((l) =>
        l.startsWith(`${selectedCategory}::`),
      );
      const subcategory = matchedLabel
        ? matchedLabel.split("::").slice(1).join("::")
        : "Uncategorized";
      return { ...d, subcategory };
    });

    return { points, labelColorMap };
  }, [rawChartData, selectedCategory, labels]);

  // Available subcategories
  const availableSubs = React.useMemo(() => {
    const set = new Set(enriched.points.map((p) => p.subcategory));
    return Array.from(set);
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
      const data = filteredData.length > 0 ? filteredData : rawChartData;

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
    }, [filteredData, rawChartData]);

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
    const labelId = `${selectedCategory}::${sub}`;
    const gitlabColor = enriched.labelColorMap.get(labelId);
    if (gitlabColor) return gitlabColor;
    const idx = availableSubs.indexOf(sub);
    return PALETTE[idx % PALETTE.length];
  };

  const CustomScatterShape = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return null;
    const sub = payload?.subcategory || "Uncategorized";
    const color = getColor(sub);
    return <circle cx={cx} cy={cy} r={4} fill={color} opacity={0.7} />;
  };

  const handleScatterClick = (_: unknown, point: any) => {
    const url = point?.issueUrl || point?.payload?.issueUrl;
    if (url) window.open(url, "_blank");
  };

  if (categoryOptions.length === 0 || !labels[selectedCategory]) {
    return (
      <Card>
        <CardHeader title="Estimate Accuracy" />
        <CardContent>
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            No data available.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (rawChartData.length === 0) {
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
    <Card>
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
              value={selectedCategory}
              onChange={(e: SelectChangeEvent<string>) =>
                setSelectedCategory(e.target.value as string)
              }
              sx={{ minWidth: 120 }}
              size="small"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {availableSubs.length > 1 && (
              <Select<string[]>
                multiple
                value={selectedSubcategories}
                onChange={(e: any) =>
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
      <CardContent>
        {filteredData.length === 0 ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: "center", py: 4 }}
          >
            No issues match the selected subcategories.
          </Typography>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
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
                shape={<CustomScatterShape />}
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

type RawPoint = {
  x: number;
  y: number;
  title: string;
  issueUrl: string;
  issueLabels: string[];
  subcategory: string;
};
