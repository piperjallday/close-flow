import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import AppShell from "../../components/AppShell";

export default async function DealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .in("status", ["Fav Offers", "Closed Deals"])
    .order("created_at", { ascending: false });

  const deals = leads || [];
  const closedVolume = deals
    .filter((d) => d.status === "Closed Deals")
    .reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);
  const pendingVolume = deals
    .filter((d) => d.status === "Fav Offers")
    .reduce((sum, d) => sum + Number(d.estimated_value || 0), 0);

  return (
    <AppShell userEmail={user.email || ""} searchPlaceholder="Deals & Offers...">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Deals & Closing Pipeline</h1>
        <p className="text-sm text-gray-400">Track pending offers and closed transaction volume</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#24282B] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-1">Closed Volume</div>
          <div className="text-3xl font-bold text-green-400">${closedVolume.toLocaleString()}</div>
        </div>
        <div className="bg-[#24282B] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-1">Pending Offers Volume</div>
          <div className="text-3xl font-bold text-yellow-400">${pendingVolume.toLocaleString()}</div>
        </div>
        <div className="bg-[#24282B] p-6 rounded-xl border border-gray-800">
          <div className="text-sm text-gray-400 mb-1">Total Active & Closed Deals</div>
          <div className="text-3xl font-bold text-white">{deals.length}</div>
        </div>
      </div>

      <div className="bg-[#24282B] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
              <th className="py-3.5 px-6">Client</th>
              <th className="py-3.5 px-6">Deal Value</th>
              <th className="py-3.5 px-6">Stage</th>
              <th className="py-3.5 px-6">Tag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-sm">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-[#2A2E32]/60">
                <td className="py-4 px-6 font-medium text-white">{deal.full_name}</td>
                <td className="py-4 px-6 text-green-400 font-semibold">
                  ${Number(deal.estimated_value || 0).toLocaleString()}
                </td>
                <td className="py-4 px-6">
                  <span
                    className={`text-xs px-2.5 py-1 rounded ${
                      deal.status === "Closed Deals"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {deal.status}
                  </span>
                </td>
                <td className="py-4 px-6 text-gray-400">{deal.tag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
