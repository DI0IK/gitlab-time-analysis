import { Chip } from "@mui/material";

function groupColorGenerator(group: string) {
  const hash = Array.from(group).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  );
  const colors = [
    "#e57373", // red
    "#64b5f6", // blue
    "#81c784", // green
    "#ffb74d", // orange
    "#ba68c8", // purple
    "#4db6ac", // teal
    "#a1887f", // brown
    "#f06292", // pink
    "#7986cb", // indigo
    "#4dd0e1", // cyan
  ];
  const bgColor = colors[hash % colors.length];

  // Calculate luminance to decide foreground color
  function getLuminance(hex: string) {
    const rgb = hex
      .replace(/^#/, "")
      .match(/.{2}/g)!
      .map((x) => parseInt(x, 16) / 255);
    // sRGB luminance formula
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  }

  const fgColor = getLuminance(bgColor) > 0.6 ? "#000" : "#fff";

  return { backgroundColor: bgColor, color: fgColor };
}

export default function Label({
  group,
  name,
}: {
  group?: string;
  name: string;
}) {
  if (name.includes("::")) {
    const [labelGroup, labelName] = name.split("::");
    const { backgroundColor, color } = groupColorGenerator(labelGroup);
    return (
      <Chip
        label={labelGroup + "::" + labelName}
        size="small"
        sx={{
          backgroundColor,
          color,
        }}
      />
    );
  }

  if (group) {
    const { backgroundColor, color } = groupColorGenerator(group);
    return (
      <Chip
        label={group + "::" + name}
        size="small"
        sx={{
          backgroundColor,
          color,
          fontWeight: "bold",
        }}
      />
    );
  }

  const { color, backgroundColor } = groupColorGenerator("default");

  return (
    <Chip
      label={name}
      size="small"
      sx={{
        backgroundColor,
        color,
        fontWeight: "bold",
      }}
    />
  );
}
