import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import WorkflowsClient from "./WorkflowsClient";

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id || "";

  const [{ data: workflows }, { data: logs }] = await Promise.all([
    supabase
      .from("workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("workflow_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <WorkflowsClient
      userEmail={user.email || ""}
      tenantId={tenantId}
      initialWorkflows={workflows || []}
      initialLogs={logs || []}
    />
  );
}