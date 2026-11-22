import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const UNLIMITED_TEAM_EMAILS = [
  "frankieguerridoworks@gmail.com",
];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const userEmail = (data.user.email || "").toLowerCase().trim();
      const isInternalFounder = UNLIMITED_TEAM_EMAILS.map((e) => e.toLowerCase()).includes(userEmail);

      // Use service role key to safely check & claim workspace invites across RLS
      const adminSupabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: existingProfile } = await adminSupabase
        .from("users")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        // 1. Check if this email has a pending workspace invite
        const { data: invite } = await adminSupabase
          .from("workspace_invites")
          .select("id, tenant_id, role")
          .eq("email", userEmail)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (invite?.tenant_id) {
          await adminSupabase.from("users").insert([
            {
              id: data.user.id,
              email: userEmail,
              tenant_id: invite.tenant_id,
              role: invite.role || "agent",
            },
          ]);

          await adminSupabase
            .from("workspace_invites")
            .update({ status: "accepted" })
            .eq("id", invite.id);
        } else {
          // 2. Otherwise provision a new workspace (unlimited if founder email)
          const displayName =
            data.user.user_metadata?.full_name ||
            userEmail.split("@")[0] ||
            "Agent";

          const { data: newTenant } = await adminSupabase
            .from("tenants")
            .insert([
              {
                name: `${displayName}'s Workspace`,
                plan_tier: isInternalFounder ? "enterprise" : "trialing",
                subscription_status: isInternalFounder ? "active" : "trialing",
                is_unlimited: isInternalFounder,
              },
            ])
            .select()
            .single();

          if (newTenant) {
            await adminSupabase.from("users").insert([
              {
                id: data.user.id,
                email: userEmail,
                tenant_id: newTenant.id,
                role: "admin",
              },
            ]);
          }
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}