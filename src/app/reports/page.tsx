import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: leads }, { data: listings }, { data: tasks }] =
    await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("listings").select("*"),
      supabase.from("tasks").select("*"),
    ]);

  return (
    <ReportsClient
      userEmail={user.email || ""}
      leads={leads || []}
      listings={listings || []}
      tasks={tasks || []}
    />
  );
}
