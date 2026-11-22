import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, email, role, tenant_id, tenants(id, name, has_clearclose_ai, plan_tier, subscription_status, trial_ends_at, ai_opening_script)"
    )
    .eq("id", user.id)
    .single();

  const tenantData = Array.isArray(profile?.tenants)
    ? profile?.tenants[0]
    : profile?.tenants;

  const [{ data: members }, { data: invites }, { data: partnerLenders }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("tenant_invites")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("partner_lenders")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

  return (
    <SettingsClient
      currentUserId={user.id}
      userEmail={user.email || ""}
      currentUserRole={profile?.role || "admin"}
      tenantId={profile?.tenant_id || ""}
      initialWorkspaceName={tenantData?.name || "CloseFlow Workspace"}
      initialClearCloseAI={Boolean(tenantData?.has_clearclose_ai)}
      initialPlanTier={tenantData?.plan_tier || "agent"}
      initialSubscriptionStatus={tenantData?.subscription_status || "trialing"}
      initialTrialEndsAt={tenantData?.trial_ends_at || null}
      initialOpeningScript={
        tenantData?.ai_opening_script ||
        "Hi {{first_name}}, thanks for checking out {{source_label}}! Are you looking to make a move in the next 3-6 months?"
      }
      initialMembers={members || []}
      initialInvites={invites || []}
      initialLenders={partnerLenders || []}
    />
  );
}
