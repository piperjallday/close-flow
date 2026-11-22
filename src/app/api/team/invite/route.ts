import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, role = "agent" } = await request.json();
    const cleanEmail = String(email || "").toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: currentProfile } = await adminSupabase
      .from("users")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (!currentProfile?.tenant_id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Check if user already exists in auth/users and link immediately if so
    const { data: existingUser } = await adminSupabase
      .from("users")
      .select("id, tenant_id")
      .eq("email", cleanEmail)
      .single();

    if (existingUser) {
      if (existingUser.tenant_id === currentProfile.tenant_id) {
        return NextResponse.json({ error: "User is already in your workspace" }, { status: 400 });
      }
      // Move existing account into this unlimited team workspace
      await adminSupabase
        .from("users")
        .update({ tenant_id: currentProfile.tenant_id, role })
        .eq("id", existingUser.id);

      return NextResponse.json({
        status: "linked",
        message: `${cleanEmail} has been added to your workspace with full access.`,
      });
    }

    // Create pending invite so they join automatically on first Google/Email login
    const { data: invite, error } = await adminSupabase
      .from("workspace_invites")
      .upsert(
        [
          {
            tenant_id: currentProfile.tenant_id,
            email: cleanEmail,
            role,
            invited_by: user.email,
            status: "pending",
          },
        ],
        { onConflict: "tenant_id,email" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      status: "invited",
      invite,
      message: `Invite created for ${cleanEmail}. They will automatically join your unlimited workspace when they log in.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to invite team member";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { inviteId, memberId } = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: currentProfile } = await adminSupabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!currentProfile?.tenant_id) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    if (inviteId) {
      await adminSupabase
        .from("workspace_invites")
        .delete()
        .eq("id", inviteId)
        .eq("tenant_id", currentProfile.tenant_id);
    }

    if (memberId && memberId !== user.id) {
      await adminSupabase
        .from("users")
        .delete()
        .eq("id", memberId)
        .eq("tenant_id", currentProfile.tenant_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}