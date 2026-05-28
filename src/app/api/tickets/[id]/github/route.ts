import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branches = await db.githubBranch.findMany({ where: { ticketId: id } });
    const prs = await db.githubPullRequest.findMany({ where: { ticketId: id } });

    return NextResponse.json({ branches, pullRequests: prs });
  } catch (error) {
    console.error("Get linked GitHub items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sessionUser = await getUserFromRequest(request);
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, name, url, title, number, state } = await request.json();

    if (type === "branch") {
      if (!name || !url) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      const branch = await db.githubBranch.create({
        data: { ticketId: id, name, url }
      });
      return NextResponse.json(branch);
    } 
    
    if (type === "pr") {
      if (!title || !number || !url || !state) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      const pr = await db.githubPullRequest.create({
        data: { ticketId: id, title, number, url, state }
      });
      return NextResponse.json(pr);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Item already linked to this ticket" }, { status: 400 });
    }
    console.error("Link GitHub item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
