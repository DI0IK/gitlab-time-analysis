import React from "react";
import Select from "@mui/material/Select";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";
import { GroupContext } from "../GroupContext";

export default function PersonSelectorWrapper({
  children,
  title,
}: {
  children: (member: string | "all") => React.ReactNode;
  title: string;
}) {
  const [person, setPerson] = React.useState<string>("all");
  const { members } = React.useContext(GroupContext);

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
              value={person}
              onChange={(e) => setPerson(e.target.value as string)}
            >
              <option value="all">All Members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />
      <CardContent>{children(person)}</CardContent>
    </Card>
  );
}
