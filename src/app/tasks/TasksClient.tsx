"use client";

import { useState, useEffect } from "react";
import {
  Plus, Trash2, CheckCircle2, Circle, Calendar, Sparkles,
  UserCheck, AlertCircle, Lock, ArrowRight, X
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

interface TasksClientProps {
  userEmail: string;
  tenantId: string;
  hasClearCloseAI: boolean;
  initialTasks: any[];
  initialLeads: any[];
  teamMembers: any[];
}

export default function TasksClient({
  userEmail,
  tenantId,
  hasClearCloseAI: initialSubscription,
  initialTasks,
  initialLeads,
  teamMembers,
}: TasksClientProps) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [leads, setLeads] = useState<any[]>(initialLeads);
  const [hasClearCloseAI, setHasClearCloseAI] = useState(initialSubscription);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"All" | "Pending" | "Completed" | "ClearClose AI">("All");

  // New Task Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    task_type: "Follow-Up",
    priority: "Medium",
    due_date: "",
    lead_id: "",
    assigned_to_email: userEmail,
  });

  // ClearClose AI Offer Handoff Modal
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);
  const [selectedHandoffLeadId, setSelectedHandoffLeadId] = useState(
    initialLeads[0]?.id || ""
  );
  const [offerNotes, setOfferNotes] = useState("");
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [handoffBanner, setHandoffBanner] = useState("");

  // Real-time Team Sync across all logged-in teammates in this tenant
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`team-tasks-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
          } else if (payload.eventType === "INSERT") {
            // Fetch full row with joined lead info
            const { data } = await supabase
              .from("tasks")
              .select("*, leads(id, full_name, status, estimated_value)")
              .eq("id", payload.new.id)
              .single();
            if (data) {
              setTasks((prev) =>
                prev.some((t) => t.id === data.id) ? prev : [data, ...prev]
              );
            }
          } else if (payload.eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase]);

  // Create regular task or follow-up reminder
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setIsSaving(true);

    const isHandoffType = newTask.task_type === "ClearClose AI Handoff";

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          title: newTask.title.trim(),
          task_type: newTask.task_type,
          priority: newTask.priority,
          due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
          lead_id: newTask.lead_id || null,
          assigned_to_email: newTask.assigned_to_email || userEmail,
          created_by_email: userEmail,
          is_clearclose_handoff: isHandoffType,
        },
      ])
      .select("*, leads(id, full_name, status, estimated_value)")
      .single();

    setIsSaving(false);

    if (!error && data) {
      setTasks((prev) => (prev.some((t) => t.id === data.id) ? prev : [data, ...prev]));
      setNewTask({
        title: "",
        task_type: "Follow-Up",
        priority: "Medium",
        due_date: "",
        lead_id: "",
        assigned_to_email: userEmail,
      });
      setIsAddModalOpen(false);
    }
  };

  // Toggle Task Completion (syncs across team)
  const handleToggleComplete = async (task: any) => {
    const nextCompleted = !task.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t))
    );
    await supabase
      .from("tasks")
      .update({ completed: nextCompleted })
      .eq("id", task.id);
  };

  // Delete Task (deletes across team)
  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").delete().eq("id", taskId);
  };

  // Transition Lead Ready for Offer -> ClearClose AI Transaction Coordinator
  const handleClearCloseTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasClearCloseAI || !selectedHandoffLeadId) return;

    setIsHandingOff(true);
    const targetLead = leads.find((l) => l.id === selectedHandoffLeadId);

    // 1. Move lead to 'Fav Offers' and tag as 'ClearClose AI'
    await supabase
      .from("leads")
      .update({ status: "Fav Offers", tag: "ClearClose AI" })
      .eq("id", selectedHandoffLeadId);

    setLeads((prev) =>
      prev.map((l) =>
        l.id === selectedHandoffLeadId
          ? { ...l, status: "Fav Offers", tag: "ClearClose AI" }
          : l
      )
    );

    // 2. Create high-priority ClearClose AI Transaction Coordinator task for the team
    const taskTitle = `ClearClose AI Offer Package: ${targetLead?.full_name || "Lead"}${
      offerNotes.trim() ? ` — ${offerNotes.trim()}` : ""
    }`;

    const { data: createdTask } = await supabase
      .from("tasks")
      .insert([
        {
          title: taskTitle,
          task_type: "ClearClose AI Handoff",
          priority: "High",
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          lead_id: selectedHandoffLeadId,
          assigned_to_email: userEmail,
          created_by_email: userEmail,
          is_clearclose_handoff: true,
        },
      ])
      .select("*, leads(id, full_name, status, estimated_value)")
      .single();

    setIsHandingOff(false);

    if (createdTask) {
      setTasks((prev) =>
        prev.some((t) => t.id === createdTask.id) ? prev : [createdTask, ...prev]
      );
      setHandoffBanner(
        `${targetLead?.full_name} transitioned to ClearClose AI Transaction Coordinator & moved to Fav Offers.`
      );
      setOfferNotes("");
      setIsHandoffModalOpen(false);
    }
  };

  // Toggle ClearClose AI Subscription status on the team's tenant record
  const handleToggleSubscription = async () => {
    const nextState = !hasClearCloseAI;
    setHasClearCloseAI(nextState);
    await supabase
      .from("tenants")
      .update({ has_clearclose_ai: nextState })
      .eq("id", tenantId);
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.leads?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assigned_to_email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterTab === "Pending") return matchesSearch && !task.completed;
    if (filterTab === "Completed") return matchesSearch && task.completed;
    if (filterTab === "ClearClose AI") return matchesSearch && task.is_clearclose_handoff;
    return matchesSearch;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <AppShell
      userEmail={userEmail}
      notificationCount={pendingCount}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search team tasks, leads, or assignees..."
    >
      {/* Header & Action Buttons */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Team Tasks & Follow-Up Reminders</h1>
            <span className="bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] px-2.5 py-0.5 rounded-full">
              Live Team Sync
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            Shared reminders across your team — updates and deletions sync in real time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHandoffModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Sparkles size={16} className="text-purple-400" />
            <span>Offer Ready → ClearClose AI</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>New Reminder</span>
          </button>
        </div>
      </div>

      {/* ClearClose AI Handoff Confirmation Banner */}
      {handoffBanner && (
        <div className="bg-purple-500/15 border border-purple-500/40 text-purple-200 text-sm px-4 py-3 rounded-xl mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400 shrink-0" />
            <span>{handoffBanner}</span>
          </div>
          <button
            onClick={() => setHandoffBanner("")}
            className="text-purple-300 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ClearClose AI Subscription Status Bar */}
      <div className="bg-[#24282B] border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              hasClearCloseAI
                ? "bg-purple-500/20 text-purple-400"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <span>ClearClose AI Transaction Coordinator</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  hasClearCloseAI
                    ? "bg-green-500/20 text-green-400"
                    : "bg-yellow-500/20 text-yellow-400"
                }`}
              >
                {hasClearCloseAI ? "Subscribed" : "Not Subscribed"}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {hasClearCloseAI
                ? "Active: Any lead ready to write an offer can be handed off directly to ClearClose AI."
                : "Subscribe your team to automate offer prep, disclosures, and contract-to-close coordination."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleSubscription}
          className="text-xs bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          {hasClearCloseAI ? "Simulate Unsubscribed" : "Activate ClearClose AI"}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(["All", "Pending", "Completed", "ClearClose AI"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filterTab === tab
                ? "bg-green-600 text-white"
                : "bg-[#24282B] text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Team Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-[#24282B] border border-dashed border-gray-800 rounded-xl p-10 text-center text-gray-500 text-sm">
            No tasks found in this view. Click <strong>New Reminder</strong> to schedule a follow-up.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isOverdue =
              !task.completed && task.due_date && new Date(task.due_date) < new Date();
            return (
              <div
                key={task.id}
                className={`bg-[#24282B] border rounded-xl p-4 flex items-center justify-between gap-4 transition-colors ${
                  task.is_clearclose_handoff
                    ? "border-purple-500/40"
                    : "border-gray-800 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="mt-0.5 text-gray-400 hover:text-green-400 transition-colors cursor-pointer shrink-0"
                    title={task.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {task.completed ? (
                      <CheckCircle2 size={20} className="text-green-500" />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          task.completed ? "line-through text-gray-500" : "text-white"
                        }`}
                      >
                        {task.title}
                      </span>

                      {task.is_clearclose_handoff && (
                        <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded font-medium">
                          <Sparkles size={10} /> ClearClose AI
                        </span>
                      )}

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          task.priority === "High"
                            ? "bg-red-500/20 text-red-400"
                            : task.priority === "Low"
                            ? "bg-gray-800 text-gray-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-1.5">
                      <span className="bg-[#111315] px-2 py-0.5 rounded border border-gray-800">
                        {task.task_type}
                      </span>

                      {task.leads?.full_name && (
                        <span className="text-green-400 font-medium">
                          Lead: {task.leads.full_name}
                        </span>
                      )}

                      {task.assigned_to_email && (
                        <span className="flex items-center gap-1">
                          <UserCheck size={12} /> {task.assigned_to_email.split("@")[0]}
                        </span>
                      )}

                      {task.due_date && (
                        <span
                          className={`flex items-center gap-1 ${
                            isOverdue ? "text-red-400 font-medium" : ""
                          }`}
                        >
                          <Calendar size={12} />
                          {new Date(task.due_date).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {isOverdue && " (Overdue)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-gray-500 hover:text-red-400 p-2 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Delete across team"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Modal 1: Add Follow-Up Reminder */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Team Task / Reminder</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Task Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call Elena about Saturday tour feedback"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={newTask.task_type}
                    onChange={(e) => setNewTask({ ...newTask, task_type: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Showing">Property Showing</option>
                    <option value="Offer Prep">Offer Prep</option>
                    {hasClearCloseAI && (
                      <option value="ClearClose AI Handoff">ClearClose AI Handoff</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Related Lead</label>
                  <select
                    value={newTask.lead_id}
                    onChange={(e) => setNewTask({ ...newTask, lead_id: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="">-- None --</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Assign To</label>
                  <select
                    value={newTask.assigned_to_email}
                    onChange={(e) =>
                      setNewTask({ ...newTask, assigned_to_email: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    {teamMembers.length > 0 ? (
                      teamMembers.map((m) => (
                        <option key={m.id} value={m.email}>
                          {m.email.split("@")[0]}
                        </option>
                      ))
                    ) : (
                      <option value={userEmail}>{userEmail.split("@")[0]}</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Reminder Date & Time</label>
                <input
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Transition Lead to ClearClose AI Transaction Coordinator */}
      {isHandoffModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-purple-500/40 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" />
                <h3 className="text-lg font-semibold">ClearClose AI Handoff</h3>
              </div>
              <button
                onClick={() => setIsHandoffModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {!hasClearCloseAI ? (
              <div className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                  <Lock size={18} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300 space-y-1">
                    <p className="font-semibold text-yellow-300">
                      ClearClose AI Subscription Required
                    </p>
                    <p>
                      Your team workspace is not currently subscribed to the ClearClose AI
                      Transaction Coordinator add-on. Activate it to automatically draft offer
                      packages and assign transaction coordination tasks.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsHandoffModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleToggleSubscription();
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Activate ClearClose AI
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleClearCloseTransition} className="space-y-4">
                <p className="text-xs text-gray-400">
                  Select a lead who is ready to write an offer. CloseFlow will move them to{" "}
                  <strong className="text-white">Fav Offers</strong>, tag them for{" "}
                  <strong className="text-purple-300">ClearClose AI</strong>, and create a
                  shared Transaction Coordinator task for your team.
                </p>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Select Offer-Ready Lead *
                  </label>
                  <select
                    required
                    value={selectedHandoffLeadId}
                    onChange={(e) => setSelectedHandoffLeadId(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                  >
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.full_name} ({lead.status} — $
                        {Number(lead.estimated_value || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Offer Details / Property Address (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. $875k offer on 1245 Maple Ave, 21-day close"
                    value={offerNotes}
                    onChange={(e) => setOfferNotes(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsHandoffModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isHandingOff}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
                  >
                    <span>{isHandingOff ? "Transitioning..." : "Transition to ClearClose AI"}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}