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
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id || "";
  const currentUserRole = profile?.role || "agent";

  const [
    { data: tenant },
    { data: members },
    { data: invites },
    { data: lenders },
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", tenantId).single(),
    supabase
      .from("users")
      .select("id, email, role")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tenant_invites")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_lenders")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <SettingsClient
      currentUserId={user.id}
      userEmail={user.email || ""}
      currentUserRole={currentUserRole}
      tenantId={tenantId}
      initialWorkspaceName={tenant?.name || "CloseFlow Workspace"}
      initialClearCloseAI={Boolean(tenant?.has_clearclose_ai)}
      initialPlanTier={tenant?.plan_tier || "agent"}
      initialSubscriptionStatus={tenant?.subscription_status || "trialing"}
      initialTrialEndsAt={tenant?.trial_ends_at || null}
      isUnlimited={Boolean(tenant?.is_unlimited)}
      initialThemeMode={tenant?.theme_mode || "dark"}
      initialBrandColor={tenant?.brand_color || "#22c55e"}
      initialOpeningScript={
        tenant?.ai_opening_script ||
        "Hi {{first_name}}, thanks for reaching out about {{source_label}}! Are you looking to buy, sell, or invest in the next 90 days?"
      }
      initialMembers={members || []}
      initialInvites={invites || []}
      initialLenders={lenders || []}
    />
  );
}