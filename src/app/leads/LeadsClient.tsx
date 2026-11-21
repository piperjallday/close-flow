"use client";

import { useState } from "react";
import { Plus, Trash2, Mail, Phone, X } from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

const STAGES = ["All", "New Leads", "Contacted", "Property Tours", "Fav Offers", "Closed Deals"];
const EDIT_STAGES = ["New Leads", "Contacted", "Property Tours", "Fav Offers", "Closed Deals"];

export default function LeadsClient({
  userEmail,
  initialLeads,
}: {
  userEmail: string;
  initialLeads: any[];
}) {
  const supabase = createClient();
  const [leads, setLeads] = useState(initialLeads);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newLead, setNewLead] = useState({
    full_name: "",
    email: "",
    phone: "",
    estimated_value: "",
    status: "New Leads",
    tag: "New",
  });

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.full_name.trim()) return;
    setIsSaving(true);

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          full_name: newLead.full_name.trim(),
          email: newLead.email.trim() || null,
          phone: newLead.phone.trim() || null,
          estimated_value: Number(newLead.estimated_value) || 0,
          status: newLead.status,
          tag: newLead.tag.trim() || "New",
        },
      ])
      .select()
      .single();

    setIsSaving(false);
    if (!error && data) {
      setLeads((prev) => [data, ...prev]);
      setNewLead({ full_name: "", email: "", phone: "", estimated_value: "", status: "New Leads", tag: "New" });
      setIsModalOpen(false);
    }
  };

  const handleStageChange = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await supabase.from("leads").update({ status }).eq("id", id);
  };

  const handleDelete = async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await supabase.from("leads").delete().eq("id", id);
  };

  const filtered = leads.filter((l) => {
    const matchesSearch =
      l.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tag?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "All" || l.status === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <AppShell
      userEmail={userEmail}
      notificationCount={leads.length}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search leads by name, email, or tag..."
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Leads Directory</h1>
          <p className="text-sm text-gray-400">Manage all buyer and seller leads across your pipeline</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Stage Filter Pills */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              stageFilter === stage
                ? "bg-green-600 text-white"
                : "bg-[#24282B] text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {stage}
          </button>
        ))}
      </div>

      {/* Leads Table */}
      <div className="bg-[#24282B] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase">
              <th className="py-3.5 px-6">Lead Name</th>
              <th className="py-3.5 px-6">Contact</th>
              <th className="py-3.5 px-6">Est. Value</th>
              <th className="py-3.5 px-6">Tag</th>
              <th className="py-3.5 px-6">Pipeline Stage</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No leads match your current filter.
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#2A2E32]/60 transition-colors">
                  <td className="py-4 px-6 font-medium text-white">{lead.full_name}</td>
                  <td className="py-4 px-6 text-xs text-gray-400 space-y-1">
                    {lead.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} /> {lead.email}
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} /> {lead.phone}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6 text-green-400 font-medium">
                    ${Number(lead.estimated_value || 0).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <span className="bg-green-500/20 text-green-400 text-xs px-2.5 py-0.5 rounded">
                      {lead.tag || "New"}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStageChange(lead.id, e.target.value)}
                      className="bg-[#111315] text-gray-200 text-xs border border-gray-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-green-500 cursor-pointer"
                    >
                      {EDIT_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleDelete(lead.id)}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                      title="Delete lead"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Lead</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={newLead.full_name}
                onChange={(e) => setNewLead({ ...newLead, full_name: e.target.value })}
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <input
                  type="text"
                  placeholder="Phone"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Est. Value ($)"
                  value={newLead.estimated_value}
                  onChange={(e) => setNewLead({ ...newLead, estimated_value: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <input
                  type="text"
                  placeholder="Tag (Hot, Buyer)"
                  value={newLead.tag}
                  onChange={(e) => setNewLead({ ...newLead, tag: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <select
                value={newLead.status}
                onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              >
                {EDIT_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
                  {isSaving ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}