import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return <LeadsClient userEmail={user.email || ""} initialLeads={leads || []} />;
}