"use client";

import RefreshIcon from "@mui/icons-material/Refresh";
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import React from "react";
import { GroupContext } from "../GroupContext";

import { useThemeMode } from "../ThemeContext";

const CACHE_TTL_MS = 3 * 60 * 1000;

function formatAge(ageMs: number): string {
  const min = Math.floor(ageMs / 60000);
  if (min < 1) return "just now";
  if (min === 1) return "1 min ago";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  const remainMin = min % 60;
  if (hrs === 1) return `1h ${remainMin}m ago`;
  return `${hrs}h ${remainMin}m ago`;
}

export default function StaleIndicator() {
  const { lastFetchedAt, refreshData } = React.useContext(GroupContext);
  const { presentationMode } = useThemeMode();
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const timestamps = Object.values(lastFetchedAt);
  if (presentationMode || timestamps.length === 0) return null;

  const oldest = Math.min(...timestamps);
  const age = now - oldest;
  const isFresh = age < CACHE_TTL_MS;

  const color = isFresh ? "success" : age < 10 * 60 * 1000 ? "warning" : "error";

  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      {Object.entries(lastFetchedAt).map(([key, ts]) => (
        <Typography key={key} variant="caption" display="block">
          {key}: {new Date(ts).toLocaleTimeString()}
        </Typography>
      ))}
    </Box>
  );

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
      }}
    >
      <Tooltip title={tooltipContent} arrow placement="left">
        <Chip
          label={isFresh ? "Data current" : formatAge(age)}
          color={color}
          size="small"
          variant="outlined"
          sx={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.5)" }}
        />
      </Tooltip>
      <Tooltip title="Refresh data" arrow placement="top">
        <IconButton
          size="small"
          onClick={refreshData}
          sx={{
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.75)" },
          }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
