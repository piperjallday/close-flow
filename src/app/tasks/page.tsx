import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import AppShell from "../../components/AppShell";

export default async function TasksPage() {
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

  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, status, intent_score, tags, created_at")
    .eq("tenant_id", profile?.tenant_id || "")
    .order("created_at", { ascending: false });

  return (
    <AppShell userEmail={user.email || ""} searchPlaceholder="Search tasks & follow-ups...">
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Tasks & Priority Follow-Ups</h1>
          <p className="text-sm text-gray-400">
            Action items generated from AI Concierge qualification, property tours, and form submissions
          </p>
        </div>

        <div className="bg-[#24282B] border border-gray-800 rounded-xl divide-y divide-gray-800">
          {(leads || []).length === 0 ? (
            <p className="p-6 text-sm text-gray-400">No pending follow-up tasks right now.</p>
          ) : (
            (leads || []).map((lead) => (
              <div
                key={lead.id}
                className="p-4 flex items-center justify-between gap-4 text-sm"
              >
                <div>
                  <div className="font-semibold text-white">
                    Follow up with {lead.full_name}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Stage: {lead.status} • Intent Score: {lead.intent_score || 0}%{" "}
                    {lead.tags ? `• ${lead.tags}` : ""}
                  </div>
                </div>
                <span className="text-xs bg-green-600/20 border border-green-500/40 px-3 py-1 rounded-full font-medium">
                  {Number(lead.intent_score || 0) >= 70 ? "High Priority" : "Scheduled"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}