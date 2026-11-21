import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";
import DashboardClient from "./DashboardClient";

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

  const [{ data: leads }, { data: listings }, { data: workflows }] =
    await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("workflows").select("*").order("created_at", { ascending: true }),
    ]);

  return (
    <DashboardClient
      userEmail={user.email || ""}
      userRole={profile?.role || "agent"}
      tenantId={profile?.tenant_id || ""}
      leads={leads || []}
      listings={listings || []}
      workflows={workflows || []}
    />
  );
}