import React from "react";
import { GroupContext, GroupContextType } from "../GroupContext";
import SelectorCard from "./PersonSelectorWrapper";
import { useMediaQuery, useTheme, Box, Typography, Tooltip } from "@mui/material";

// ─── Data helpers ────────────────────────────────────────────────────────────

type DayCell = { timeSpent: number; date: string };
type SprintData = Record<string, DayCell>;
type HeatmapData = Record<string, SprintData>;

function buildHeatmapData(sprints: GroupContextType["sprints"], timelogs: GroupContextType["timelogs"]) {
  const heatmapData: HeatmapData = {};
  if (!sprints.length) return heatmapData;

  sprints.forEach((sprint) => {
    heatmapData[sprint.sprintNumber.toString()] = {};
  });

  for (
    let d = new Date(sprints[0].startDate);
    d <= new Date(new Date(sprints[sprints.length - 1].endDate).setHours(23, 59, 59, 999));
    d.setDate(d.getDate() + 1)
  ) {
    const sprint = sprints.find(
      (sp) =>
        new Date(sp.startDate) <= d &&
        d <= new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
    );
    if (sprint) {
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      heatmapData[sprint.sprintNumber.toString()][weekday] = {
        timeSpent: 0,
        date: d.toISOString().split("T")[0],
      };
    }
  }

  timelogs.forEach((log) => {
    const logDate = new Date(log.spentAt);
    const sprint = sprints.find(
      (sp) =>
        new Date(sp.startDate) <= logDate &&
        logDate <= new Date(new Date(sp.endDate).setHours(23, 59, 59, 999))
    );
    if (sprint) {
      const weekday = logDate.toLocaleDateString("en-US", { weekday: "long" });
      const sprintEntry = heatmapData[sprint.sprintNumber.toString()];
      if (sprintEntry?.[weekday]) {
        sprintEntry[weekday].timeSpent += log.timeSpent;
      }
    }
  });

  return heatmapData;
}

// ─── Cell ────────────────────────────────────────────────────────────────────

function HeatCell({
  cell,
  ratio,
  size,
  radius,
}: {
  cell: DayCell;
  ratio: number;
  size: number;
  radius: number;
}) {
  const theme = useTheme();
  const isLogged = cell.timeSpent > 0;
  const hours = (cell.timeSpent / 3600).toFixed(1);
  const isToday = (() => {
    const today = new Date();
    const cellDate = new Date(cell.date);
    return (
      today.getFullYear() === cellDate.getFullYear() &&
      today.getMonth() === cellDate.getMonth() &&
      today.getDate() === cellDate.getDate()
    );
  })();
  const dateStr = new Date(cell.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
            {dateStr}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 800, color: "primary.light", mt: 0.25 }}
          >
            {hours}h logged
          </Typography>
        </Box>
      }
      arrow
      enterTouchDelay={0}
    >
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: radius,
          flexShrink: 0,
          bgcolor: isLogged ? "primary.main" : "action.hover",
          opacity: isLogged ? 0.2 + 0.8 * ratio : 0.55,
          cursor: "pointer",
          transition: "transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease",
          border: isToday
            ? `2px solid ${theme.palette.secondary.main}`
            : "1px solid rgba(255,255,255,0.04)",
          boxShadow: isToday
            ? `0 0 8px ${theme.palette.secondary.main}99`
            : "none",
          "&:hover": {
            transform: "scale(1.25)",
            opacity: 1,
            boxShadow: `0 4px 12px ${
              isLogged ? theme.palette.primary.main + "66" : "rgba(0,0,0,0.15)"
            }`,
            zIndex: 2,
          },
        }}
      />
    </Tooltip>
  );
}

// ─── Label helpers ────────────────────────────────────────────────────────────

const DAY_ABBREV: Record<string, string> = {
  Monday: "Mo",
  Tuesday: "Tu",
  Wednesday: "We",
  Thursday: "Th",
  Friday: "Fr",
  Saturday: "Sa",
  Sunday: "Su",
};

// ─── Main component ───────────────────────────────────────────────────────────

type SprintType = GroupContextType["sprints"][number];

export default function Heatmap() {
  const { members, sprints, timelogs } = React.useContext(GroupContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <SelectorCard
      title="Heatmap"
      options={[
        ...members
          .filter((m) => !m.bot)
          .map((m) => ({ label: m.name, value: m.id, member: m })),
        { value: "all", label: "All Members" },
      ]}
      defaultSelected="all"
      data={{ sprints, timelogs }}
    >
      {(selected, { sprints, timelogs }) => {
        const filteredTimelogs =
          selected === "all"
            ? timelogs
            : timelogs.filter((log) => log.username.toString() === selected);

        const heatmapData = buildHeatmapData(sprints, filteredTimelogs);
        const sprintKeys = Object.keys(heatmapData);
        if (!sprintKeys.length) return null;

        const weekdayKeys = Object.keys(heatmapData[sprintKeys[0]] || {});

        let overallMax = 0;
        Object.values(heatmapData).forEach((sprintObj) =>
          Object.values(sprintObj).forEach((cell) => {
            if (cell.timeSpent > overallMax) overallMax = cell.timeSpent;
          })
        );
        if (overallMax === 0) overallMax = 1;

        return (
          <DesktopHeatmap
            heatmapData={heatmapData}
            sprintKeys={sprintKeys}
            weekdayKeys={weekdayKeys}
            overallMax={overallMax}
            sprints={sprints}
          />
        );
      }}
    </SelectorCard>
  );
}

// ─── Desktop layout (sprints = columns, weekdays = rows) ──────────────────────

function DesktopHeatmap({
  heatmapData,
  sprintKeys,
  weekdayKeys,
  overallMax,
  sprints,
}: {
  heatmapData: HeatmapData;
  sprintKeys: string[];
  weekdayKeys: string[];
  overallMax: number;
  sprints: SprintType[];
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dims, setDims] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isSmallScreen = dims.width > 0 && dims.width < 500;

  const GAP = isSmallScreen ? 3 : 5;
  const ROW_LABEL_W = isSmallScreen ? 20 : 28;
  const COL_LABEL_H = isSmallScreen ? 22 : 36;

  const numCols = sprintKeys.length;
  const numRows = weekdayKeys.length;

  // Compute cell size that fits both axes
  const cellW =
    dims.width > 0
      ? Math.floor((dims.width - ROW_LABEL_W - GAP * numCols) / numCols)
      : 0;
  const cellH =
    dims.height > 0
      ? Math.floor((dims.height - COL_LABEL_H - GAP * numRows) / numRows)
      : 0;

  // Use the smaller to keep cells square; clamp to a readable range (min 14px, max 36px)
  const cellSize = Math.max(14, Math.min(cellW, cellH, 36));
  const radius = Math.round(cellSize * 0.2);

  return (
    <Box
      ref={containerRef}
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        overflowX: "auto",
        overflowY: "hidden",
        pt: 1,
        width: "100%",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Box
        sx={{
          minWidth: "fit-content",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
        }}
      >
        {/* Column headers: sprint labels */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            gap: `${GAP}px`,
            pl: `${ROW_LABEL_W + GAP}px`,
            height: COL_LABEL_H,
            flexShrink: 0,
          }}
        >
          {sprintKeys.map((sprintNum, i) => {
            const sprint = sprints.find((s) => s.sprintNumber.toString() === sprintNum);
            const year = sprint ? new Date(sprint.startDate).getFullYear() : "";
            return (
              <Box
                key={sprintNum}
                sx={{
                  width: cellSize,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 0,
                }}
              >
                {!isSmallScreen && (
                  <Typography
                    sx={{
                      fontSize: "0.5rem",
                      lineHeight: 1.1,
                      opacity: 0.35,
                      fontWeight: 600,
                      color: "text.secondary",
                    }}
                  >
                    {/* Show year only when it changes */}
                    {i === 0 ||
                    sprints[i]?.startDate.slice(0, 4) !==
                      sprints[i - 1]?.startDate.slice(0, 4)
                      ? year
                      : ""}
                  </Typography>
                )}
                <Typography
                  sx={{
                    fontSize: cellSize >= 18 ? "0.65rem" : (cellSize >= 12 ? "0.5rem" : "0.4rem"),
                    fontWeight: 800,
                    color: "text.secondary",
                    lineHeight: 1.2,
                  }}
                >
                  S{sprintNum}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Rows: weekday label + cells */}
        <Box
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-evenly",
            gap: `${GAP}px`,
          }}
        >
          {weekdayKeys.map((weekday) => (
            <Box
              key={weekday}
              sx={{ display: "flex", alignItems: "center", gap: `${GAP}px` }}
            >
              {/* Row label */}
              <Box
                sx={{
                  width: ROW_LABEL_W,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                <Typography
                  sx={{
                    fontSize: cellSize >= 18 ? "0.6rem" : (cellSize >= 12 ? "0.48rem" : "0.38rem"),
                    fontWeight: 700,
                    color: "text.secondary",
                    opacity: 0.7,
                    textAlign: "right",
                    lineHeight: 1,
                  }}
                >
                  {DAY_ABBREV[weekday] ?? weekday.slice(0, 2)}
                </Typography>
              </Box>

              {/* Cells */}
              {sprintKeys.map((sprintNum) => {
                const cell = heatmapData[sprintNum]?.[weekday];
                if (!cell)
                  return (
                    <Box
                      key={sprintNum}
                      sx={{ width: cellSize, height: cellSize, flexShrink: 0 }}
                    />
                  );
                const ratio = Math.min(1, cell.timeSpent / overallMax);
                return (
                  <HeatCell
                    key={sprintNum}
                    cell={cell}
                    ratio={ratio}
                    size={cellSize}
                    radius={radius}
                  />
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}


