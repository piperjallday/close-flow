"use client";

import { useState } from "react";
import {
  Plus, Mail, Home, Users, Star, Play, Trash2, X, Zap
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

export default function WorkflowsClient({
  userEmail,
  initialWorkflows,
}: {
  userEmail: string;
  initialWorkflows: any[];
}) {
  const supabase = createClient();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    title: "",
    icon_name: "mail",
    status: "Active",
    subtext: "triggered today",
  });

  const handleAddWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflow.title.trim()) return;
    setIsSaving(true);

    const { data, error } = await supabase
      .from("workflows")
      .insert([
        {
          title: newWorkflow.title.trim(),
          icon_name: newWorkflow.icon_name,
          status: newWorkflow.status,
          triggers_count: 0,
          subtext: newWorkflow.subtext.trim() || "triggered today",
        },
      ])
      .select()
      .single();

    setIsSaving(false);
    if (!error && data) {
      setWorkflows((prev) => [...prev, data]);
      setNewWorkflow({
        title: "",
        icon_name: "mail",
        status: "Active",
        subtext: "triggered today",
      });
      setIsModalOpen(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Active" ? "Paused" : "Active";
    setWorkflows((prev) =>
      prev.map((wf) => (wf.id === id ? { ...wf, status: nextStatus } : wf))
    );
    await supabase
      .from("workflows")
      .update({ status: nextStatus })
      .eq("id", id);
  };

  const handleRunTrigger = async (wf: any) => {
    const nextCount = Number(wf.triggers_count || 0) + 1;
    setWorkflows((prev) =>
      prev.map((item) =>
        item.id === wf.id ? { ...item, triggers_count: nextCount } : item
      )
    );
    await supabase
      .from("workflows")
      .update({ triggers_count: nextCount })
      .eq("id", wf.id);
  };

  const handleDelete = async (id: string) => {
    setWorkflows((prev) => prev.filter((wf) => wf.id !== id));
    await supabase.from("workflows").delete().eq("id", id);
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case "home":
        return <Home size={18} className="text-green-400" />;
      case "users":
        return <Users size={18} className="text-blue-400" />;
      case "star":
        return <Star size={18} className="text-yellow-400" />;
      default:
        return <Mail size={18} className="text-purple-400" />;
    }
  };

  const filtered = workflows.filter((wf) =>
    wf.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = workflows.filter((wf) => wf.status === "Active").length;
  const totalTriggers = workflows.reduce(
    (sum, wf) => sum + Number(wf.triggers_count || 0),
    0
  );

  return (
    <AppShell
      userEmail={userEmail}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search automated workflows..."
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Automated Workflows</h1>
          <p className="text-sm text-gray-400">
            {activeCount} active automations • {totalTriggers.toLocaleString()} total executions
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>New Workflow</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((wf) => {
          const isPaused = wf.status === "Paused";
          return (
            <div
              key={wf.id}
              className="bg-[#24282B] border border-gray-800 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#1A1D1F] border border-gray-800 flex items-center justify-center">
                      {renderIcon(wf.icon_name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">
                        {wf.title}
                      </h3>
                      <span className="text-xs text-gray-500">{wf.subtext}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(wf.id)}
                    className="text-gray-500 hover:text-red-400 p-1 rounded cursor-pointer"
                    title="Delete workflow"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-3xl font-bold text-white">
                    {wf.triggers_count}
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Zap size={12} className="text-green-400" /> runs recorded
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                <button
                  onClick={() => handleToggleStatus(wf.id, wf.status)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                    isPaused
                      ? "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                  }`}
                >
                  {wf.status}
                </button>

                <button
                  onClick={() => handleRunTrigger(wf)}
                  disabled={isPaused}
                  className="inline-flex items-center gap-1.5 text-xs bg-[#111315] hover:bg-gray-800 disabled:opacity-40 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Play size={12} className="text-green-400" />
                  <span>Test Trigger</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create Automated Workflow</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWorkflow} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Workflow Title (e.g. New Listing Alert) *"
                value={newWorkflow.title}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, title: e.target.value })
                }
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newWorkflow.icon_name}
                  onChange={(e) =>
                    setNewWorkflow({ ...newWorkflow, icon_name: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                >
                  <option value="mail">Email (Mail)</option>
                  <option value="home">Property (Home)</option>
                  <option value="users">Nurture (Users)</option>
                  <option value="star">Review (Star)</option>
                </select>
                <select
                  value={newWorkflow.status}
                  onChange={(e) =>
                    setNewWorkflow({ ...newWorkflow, status: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Subtext (e.g. triggered today)"
                value={newWorkflow.subtext}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, subtext: e.target.value })
                }
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              />
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
                  {isSaving ? "Saving..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}