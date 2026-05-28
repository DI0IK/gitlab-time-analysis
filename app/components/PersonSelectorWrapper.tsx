import React from "react";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import { UserAvatar } from "./UserAvatar";

export interface SelectOption {
  value: string;
  label: string;
  member?: {
    id: string;
    name: string;
    url: string;
  };
}

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
  options: SelectOption[];
  data: T;
}) {
  const [option, setOption] = React.useState<string>(defaultSelected);

  React.useEffect(() => {
    setOption(defaultSelected);
  }, [defaultSelected]);

  // Determine if we have member avatars to display
  const hasMemberAvatars = options.some((opt) => opt.member);
  const selectedOption = options.find((opt) => opt.value === option);

  const handleChange = (event: SelectChangeEvent<string>) => {
    setOption(event.target.value as string);
  };

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardHeader
        title={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              justifyContent: "space-between",
            }}
          >
            <span>{title}</span>
            {hasMemberAvatars ? (
              <Select
                value={option}
                onChange={handleChange}
                renderValue={() => (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {selectedOption?.member && (
                      <UserAvatar
                        member={selectedOption.member}
                        size="small"
                        showTooltip={false}
                      />
                    )}
                    <span>{selectedOption?.label}</span>
                  </Box>
                )}
                sx={{ minWidth: 200 }}
              >
                {options.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.member ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <ListItemIcon sx={{ minWidth: "auto" }}>
                          <UserAvatar
                            member={opt.member}
                            size="small"
                            showTooltip={false}
                          />
                        </ListItemIcon>
                        <ListItemText>{opt.label}</ListItemText>
                      </Box>
                    ) : (
                      <span>{opt.label}</span>
                    )}
                  </MenuItem>
                ))}
              </Select>
            ) : (
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
            )}
          </Box>
        }
      />
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>{children(option || defaultSelected, data)}</CardContent>
    </Card>
  );
}
