import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, isInternalStaffEmail } from "@/lib/auth";
import { getUserWithTeamAccess, teamIdsForUser } from "@/lib/access";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { accessToken, email: rawEmail } = await request.json();

    let email: string | null = null;

    if (typeof rawEmail === "string" && rawEmail.trim()) {
      email = rawEmail.toLowerCase().trim();
    }

    if (email) {
      const user = await getUserByEmail(email);

      if (!user) {
        return NextResponse.json(
          {
            error:
              "Your account is not provisioned in this workspace yet. Ask an admin to invite you first.",
          },
          { status: 401 },
        );
      }

      if (
        (user.role === "USER" || user.role === "SUPER_ADMIN") &&
        !isInternalStaffEmail(email)
      ) {
        return NextResponse.json(
          {
            error:
              "Internal staff sign-in requires an @e-t.co.za email address.",
          },
          { status: 403 },
        );
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
          {
            error:
              "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
          },
          { status: 500 },
        );
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const emailRedirectTo = `${request.nextUrl.origin}/auth/login?magic=1`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        return NextResponse.json(
          { error: otpError.message || "Failed to send magic link" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        message: "Magic link sent. Check your email to continue.",
      });
    }

    if (!email) {
      if (!accessToken || typeof accessToken !== "string") {
        return NextResponse.json(
          { error: "Email or access token is required" },
          { status: 400 },
        );
      }

      const supabaseAdmin = createSupabaseAdminClient();
      const { data: supabaseData, error: supabaseError } =
        await supabaseAdmin.auth.getUser(accessToken);

      if (supabaseError || !supabaseData.user?.email) {
        return NextResponse.json(
          { error: "Invalid or expired sign-in link" },
          { status: 401 },
        );
      }

      email = supabaseData.user.email.toLowerCase().trim();
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your account is not provisioned in this workspace yet. Ask an admin to invite you first.",
        },
        { status: 401 },
      );
    }

    if (
      (user.role === "USER" || user.role === "SUPER_ADMIN") &&
      !isInternalStaffEmail(email)
    ) {
      return NextResponse.json(
        {
          error: "Internal staff sign-in requires an @e-t.co.za email address.",
        },
        { status: 403 },
      );
    }

    const full = await getUserWithTeamAccess(user.id);
    const teamIds = full ? teamIdsForUser(full) : null;

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        teamIds,
      },
    });

    response.cookies.set("userId", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof Error && error.name === "DatabaseSchemaError") {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
