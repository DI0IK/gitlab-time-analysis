import React from "react";
import Select from "@mui/material/Select";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";

export default function SelectorCard<T>({
  children,
  title,
  defaultSelected = "all",
  options,
  data,
}: {
  children: (selected: string, data: T) => React.ReactNode;
  title: string;
  defaultSelected: string;
  options: { value: string; label: string }[];
  data: T;
}) {
  const [option, setOption] = React.useState<string>(defaultSelected);

  return (
    <Card>
      <CardHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              justifyContent: "space-between",
            }}
          >
            <span>{title}</span>{" "}
            <Select
              native
              value={option}
              onChange={(e) => setOption(e.target.value as string)}
            >
              {options.map((member) => (
                <option key={member.value} value={member.value}>
                  {member.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />
      <CardContent>{children(option || defaultSelected, data)}</CardContent>
    </Card>
  );
}
