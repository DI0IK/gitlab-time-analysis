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
    const { issueUrl, state_event, estimate } = body;

    if (!issueUrl) {
      return NextResponse.json(
        { error: "issueUrl is required" },
        { status: 400 }
      );
    }

    // Parse issue URL to extract project path and issue IID
    // e.g. https://gitlab.com/group/project/-/issues/123 or /-/work_items/123
    const match = issueUrl.match(/^(?:https?:\/\/[^\/]+)\/(.+?)\/(?:-\/)?(?:issues|work_items)\/(\d+)(?:[/#?].*)?$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitLab issue URL format" },
        { status: 400 }
      );
    }

    const projectPath = match[1];
    const issueIid = match[2];
    const encodedProjectPath = encodeURIComponent(projectPath);

    let updatedState = null;
    let updatedEstimate = null;

    // 1. Update State if requested
    if (state_event === "close" || state_event === "reopen") {
      const endpoint = `/projects/${encodedProjectPath}/issues/${issueIid}`;
      const result = await runGitlabRESTQuery(endpoint, token, "PUT", {
        state_event,
      });
      updatedState = result.state;
    }

    // 2. Update Time Estimate if requested
    if (estimate !== undefined) {
      if (estimate === "reset" || estimate === 0 || estimate === "0") {
        const endpoint = `/projects/${encodedProjectPath}/issues/${issueIid}/reset_time_estimate`;
        const result = await runGitlabRESTQuery(endpoint, token, "POST");
        updatedEstimate = result.time_estimate || 0;
      } else {
        const endpoint = `/projects/${encodedProjectPath}/issues/${issueIid}/time_estimate`;
        // Convert to duration string (if number, suffix with 's', e.g. '3600s')
        const duration = typeof estimate === "number" ? `${estimate}s` : estimate;
        const result = await runGitlabRESTQuery(endpoint, token, "POST", {
          duration,
        });
        updatedEstimate = result.time_estimate || 0;
      }
    }

    // Invalidate local server cache so the frontend sees the changes immediately
    invalidateCache();

    return NextResponse.json({
      success: true,
      state: updatedState,
      timeEstimate: updatedEstimate,
    });
  } catch (error) {
    console.error("Failed to update issue:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update issue" },
      { status: 500 }
    );
  }
}
