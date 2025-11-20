"use client";
import React from "react";
import { GroupResponse } from "./api/groups/route";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Link from "@mui/material/Link";
import NextLink from "next/link";

export default function Home() {
  const [groups, setGroups] = React.useState<GroupResponse>([]);

  React.useEffect(() => {
    const fetchGroups = async () => {
      const response = await fetch("/api/groups");
      const data = await response.json();
      setGroups(data);
    };
    fetchGroups();
  }, []);

  return (
    <Card>
      <CardHeader title="Groups" />
      <CardContent>
        <List>
          {groups.map((group) => (
            <ListItem key={group.id}>
              <Link component={NextLink} href={`/${group.id}`}>
                {group.name}
              </Link>
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
