import type { Metadata } from "next";
import React from "react";
import { GITLAB_GROUP_PATH } from "../api/env";
import { apolloClient, gql } from "../api/apollo-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId: id } = await params;
  const fullPath = `${GITLAB_GROUP_PATH}/${id}`;

  let groupName = id;
  try {
    const data: any = (await apolloClient.query({
      query: gql`
        query MetadataGroupName($fullPath: ID!) {
          group(fullPath: $fullPath) {
            name
          }
        }
      `,
      variables: { fullPath },
      fetchPolicy: "no-cache",
    })).data;
    if (data) groupName = data.group.name;
  } catch {}

  const title = `${groupName} - GitLab DHBW-SE Time Analysis`;
  const description = `Time tracking analysis for ${groupName}. View sprint overviews, time per member, estimate accuracy, and more.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `/api/group/${id}/og`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/group/${id}/og`],
    },
  };
}

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
