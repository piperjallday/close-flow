import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import DashboardClient from "../DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id || "";
  const userRole = profile?.role || "agent";

  const [
    { data: tenant },
    { data: leads },
    { data: listings },
    { data: workflows },
    { data: partnerLenders },
  ] = await Promise.all([
    supabase
      .from("tenants")
      .select("theme_mode, brand_color")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("leads")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("listings")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("partner_lenders")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <DashboardClient
      userEmail={user.email || ""}
      userRole={userRole}
      tenantId={tenantId}
      themeMode={tenant?.theme_mode || "dark"}
      brandColor={tenant?.brand_color || "#22c55e"}
      leads={leads || []}
      listings={listings || []}
      workflows={workflows || []}
      partnerLenders={partnerLenders || []}
    />
  );
}