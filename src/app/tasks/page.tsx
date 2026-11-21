import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import TasksClient from "./TasksClient";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user profile & tenant subscription info
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, tenants(id, name, has_clearclose_ai)")
    .eq("id", user.id)
    .single();

  const tenantData = Array.isArray(profile?.tenants)
    ? profile?.tenants[0]
    : profile?.tenants;

  // Fetch team tasks (with linked lead name)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, leads(id, full_name, status, estimated_value)")
    .order("completed", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  // Fetch leads for linking tasks & triggering ClearClose AI handoff
  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, status, estimated_value")
    .order("full_name", { ascending: true });

  // Fetch team members in the same tenant for task assignment
  const { data: teamMembers } = await supabase
    .from("users")
    .select("id, email, role");

  return (
    <TasksClient
      userEmail={user.email || ""}
      tenantId={profile?.tenant_id || ""}
      hasClearCloseAI={Boolean(tenantData?.has_clearclose_ai)}
      initialTasks={tasks || []}
      initialLeads={leads || []}
      teamMembers={teamMembers || []}
    />
  );
}