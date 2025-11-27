import { Chip, Box } from "@mui/material";

// Helper: Calculate if text should be black or white based on background luminance
function getContrastColor(hexColor: string) {
  // Default to black if invalid hex
  if (!hexColor || !hexColor.startsWith("#")) return "#000";

  const rgb = hexColor
    .replace(/^#/, "")
    .match(/.{2}/g)
    ?.map((x) => parseInt(x, 16) / 255);

  if (!rgb) return "#000";

  // sRGB luminance formula
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > 0.5 ? "#000" : "#fff";
}

interface LabelProps {
  name: string;
  color?: string;
}

export default function Label({ name, color = "#428fdc" }: LabelProps) {
  const textColor = getContrastColor(color);

  // 1. Scoped Label (e.g. "priority::high")
  if (name.includes("::") && name.split("::")[0].trim() !== "Ungrouped") {
    const [labelGroup, labelName] = name.split("::");

    return (
      <Box
        sx={{
          display: "inline-flex",
          borderRadius: "16px",
          overflow: "hidden",
          height: "24px",
          fontSize: "0.75rem", // Slightly smaller for dense layouts
          fontWeight: 600,
          border: "1px solid",
          borderColor: "rgba(0,0,0,0.12)",
          verticalAlign: "middle",
          boxSizing: "border-box",
        }}
      >
        {/* Left Side: The Group (User defined color) */}
        <Box
          component="span"
          sx={{
            backgroundColor: color,
            color: textColor,
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {labelGroup}
        </Box>

        {/* Right Side: The Name (Standard Dark Grey) */}
        <Box
          component="span"
          sx={{
            backgroundColor: "#363636", // GitLab standard dark grey
            color: "#ffffff",
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {labelName}
        </Box>
      </Box>
    );
  }

  // 2. Standard Label
  return (
    <Chip
      label={name.replace("Ungrouped::", "")}
      size="small"
      sx={{
        backgroundColor: color,
        color: textColor,
        fontWeight: "bold",
        height: "24px",
        fontSize: "0.75rem",
      }}
    />
  );
}
