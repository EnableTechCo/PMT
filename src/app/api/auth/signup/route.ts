import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Signup is disabled. Access is invite-only and must be provisioned by an administrator.",
    },
    { status: 403 },
  );
}
