import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import WorkflowsClient from "./WorkflowsClient";

export default async function WorkflowsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: workflows } = await supabase
    .from("workflows")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <WorkflowsClient
      userEmail={user.email || ""}
      initialWorkflows={workflows || []}
    />
  );
}
