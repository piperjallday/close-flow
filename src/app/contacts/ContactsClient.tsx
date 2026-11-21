"use client";

import { useState } from "react";
import {
  Plus, Mail, Phone, Search, Trash2, X, UserCheck, Tag
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

const STAGES = [
  "New Leads",
  "Contacted",
  "Property Tours",
  "Fav Offers",
  "Closed Deals",
];

export default function ContactsClient({
  userEmail,
  initialContacts,
}: {
  userEmail: string;
  initialContacts: any[];
}) {
  const supabase = createClient();
  const [contacts, setContacts] = useState(initialContacts);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newContact, setNewContact] = useState({
    full_name: "",
    email: "",
    phone: "",
    tag: "Client",
    status: "New Leads",
    estimated_value: "",
  });

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.full_name.trim()) return;
    setIsSaving(true);

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          full_name: newContact.full_name.trim(),
          email: newContact.email.trim() || null,
          phone: newContact.phone.trim() || null,
          tag: newContact.tag.trim() || "Client",
          status: newContact.status,
          estimated_value: Number(newContact.estimated_value) || 0,
        },
      ])
      .select()
      .single();

    setIsSaving(false);
    if (!error && data) {
      setContacts((prev) =>
        [...prev, data].sort((a, b) =>
          (a.full_name || "").localeCompare(b.full_name || "")
        )
      );
      setNewContact({
        full_name: "",
        email: "",
        phone: "",
        tag: "Client",
        status: "New Leads",
        estimated_value: "",
      });
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("leads").delete().eq("id", id);
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tag?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === "All" || c.status === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <AppShell
      userEmail={userEmail}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search contacts by name, email, phone, or tag..."
    >
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Contacts Directory</h1>
          <p className="text-sm text-gray-400">
            {contacts.length} total clients, buyers, and sellers in your workspace
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="bg-[#24282B] border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-green-500 cursor-pointer"
          >
            <option value="All">All Stages ({contacts.length})</option>
            {STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      <div className="bg-[#24282B] border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase bg-[#1A1D1F]">
              <th className="py-3.5 px-6">Contact</th>
              <th className="py-3.5 px-6">Email</th>
              <th className="py-3.5 px-6">Phone</th>
              <th className="py-3.5 px-6">Tag</th>
              <th className="py-3.5 px-6">Pipeline Stage</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No matching contacts found.
                </td>
              </tr>
            ) : (
              filtered.map((contact) => (
                <tr key={contact.id} className="hover:bg-[#2A2E32]/60 transition-colors">
                  <td className="py-4 px-6 font-medium text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xs font-bold uppercase shrink-0">
                      {contact.full_name?.charAt(0) || "?"}
                    </div>
                    <span>{contact.full_name}</span>
                  </td>
                  <td className="py-4 px-6 text-gray-300">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-green-400 transition-colors"
                      >
                        <Mail size={14} className="text-gray-500" />
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-gray-300">
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-green-400 transition-colors"
                      >
                        <Phone size={14} className="text-gray-500" />
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 text-xs px-2.5 py-0.5 rounded">
                      <Tag size={11} />
                      {contact.tag || "Client"}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1.5 bg-[#111315] border border-gray-800 px-2.5 py-1 rounded">
                      <UserCheck size={12} className="text-green-500" />
                      {contact.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                      title="Delete contact"
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Contact</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddContact} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={newContact.full_name}
                onChange={(e) =>
                  setNewContact({ ...newContact, full_name: e.target.value })
                }
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Email Address"
                  value={newContact.email}
                  onChange={(e) =>
                    setNewContact({ ...newContact, email: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <input
                  type="text"
                  placeholder="Phone Number"
                  value={newContact.phone}
                  onChange={(e) =>
                    setNewContact({ ...newContact, phone: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Tag (Buyer, Seller, VIP)"
                  value={newContact.tag}
                  onChange={(e) =>
                    setNewContact({ ...newContact, tag: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <select
                  value={newContact.status}
                  onChange={(e) =>
                    setNewContact({ ...newContact, status: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                >
                  {STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}