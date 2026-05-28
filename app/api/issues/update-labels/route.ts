import { NextResponse } from "next/server";
import { runGitlabRESTQuery } from "../../gitlab";
import { invalidateCache } from "../../cache";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : undefined;

    if (!token) {
      return NextResponse.json(
        { error: "Authorization token is required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { issueUrl, labels } = body;

    if (!issueUrl || !Array.isArray(labels)) {
      return NextResponse.json(
        { error: "issueUrl and labels array are required" },
        { status: 400 }
      );
    }

    // Parse issue URL to extract project path and issue IID
    // e.g. https://gitlab.com/group/project/-/issues/123
    const match = issueUrl.match(/^(?:https?:\/\/[^\/]+)\/(.+?)\/(?:-\/)?issues\/(\d+)(?:\/.*)?$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitLab issue URL format" },
        { status: 400 }
      );
    }

    const projectPath = match[1];
    const issueIid = match[2];

    // Call GitLab API to update labels
    const endpoint = `/projects/${encodeURIComponent(projectPath)}/issues/${issueIid}`;
    
    const result = await runGitlabRESTQuery(
      endpoint,
      token,
      "PUT",
      { labels: labels.join(",") }
    );

    // Return the updated labels from the response
    const updatedLabels = result.labels || [];

    // Invalidate local server cache so the frontend sees the changes immediately
    invalidateCache();

    return NextResponse.json({
      success: true,
      labels: updatedLabels,
    });
  } catch (error) {
    console.error("Failed to update labels:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update labels" },
      { status: 500 }
    );
  }
}
