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
    .select("id, email, role, tenant_id, tenants(id, name, has_clearclose_ai)")
    .eq("id", user.id)
    .single();

  const tenantData = Array.isArray(profile?.tenants)
    ? profile?.tenants[0]
    : profile?.tenants;

  const { data: members } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });

  const { data: invites } = await supabase
    .from("tenant_invites")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <SettingsClient
      currentUserId={user.id}
      userEmail={user.email || ""}
      currentUserRole={profile?.role || "admin"}
      tenantId={profile?.tenant_id || ""}
      initialWorkspaceName={tenantData?.name || "CloseFlow Workspace"}
      initialClearCloseAI={Boolean(tenantData?.has_clearclose_ai)}
      initialMembers={members || []}
      initialInvites={invites || []}
    />
  );
}