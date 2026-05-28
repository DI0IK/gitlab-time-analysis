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

    // Call /user endpoint to test the token
    const user = await runGitlabRESTQuery("/user", token);
    
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
  } catch (error) {
    console.error("Auth test failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 401 }
    );
  }
}
