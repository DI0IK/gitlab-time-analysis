import { NextResponse } from "next/server";
import { runGitlabRESTQuery } from "../../gitlab";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Call /user endpoint to test the token, forcing the user-supplied token
    const user = await runGitlabRESTQuery("/user", token, "GET", undefined, true);
    
    if (!user || !user.username) {
      return NextResponse.json(
        { error: "Invalid token or user data not returned" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatar_url,
      webUrl: user.web_url,
    });
  } catch (error: any) {
    console.error("Auth test failed:", error);
    const msg = error?.message || "";
    let friendlyError = "Authentication failed";
    if (
      msg.includes("401") ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("invalid_token")
    ) {
      friendlyError = "Invalid or expired GitLab Personal Access Token. Please check your token.";
    } else if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
      friendlyError = "Access denied. The token does not have permission to view your user profile (/user).";
    } else {
      friendlyError = msg || "Authentication failed";
    }
    return NextResponse.json(
      { error: friendlyError },
      { status: 401 }
    );
  }
}
