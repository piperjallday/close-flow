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
    .select("tenant_id, role, tenants(theme_mode, brand_color)")
    .eq("id", user.id)
    .single();

  const tenantData = Array.isArray(profile?.tenants)
    ? profile?.tenants[0]
    : profile?.tenants;

  const [{ data: leads }, { data: listings }, { data: workflows }, { data: partnerLenders }] =
    await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("workflows").select("*").order("created_at", { ascending: true }),
      supabase.from("partner_lenders").select("*").order("created_at", { ascending: true }),
    ]);

  return (
    <DashboardClient
      userEmail={user.email || ""}
      userRole={profile?.role || "agent"}
      tenantId={profile?.tenant_id || ""}
      themeMode={tenantData?.theme_mode || "dark"}
      brandColor={tenantData?.brand_color || "#22c55e"}
      leads={leads || []}
      listings={listings || []}
      workflows={workflows || []}
      partnerLenders={partnerLenders || []}
    />
  );
}
