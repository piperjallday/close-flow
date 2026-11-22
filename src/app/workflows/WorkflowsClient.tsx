"use client";

import { useState } from "react";
import {
  Workflow, Plus, Play, Pause, Trash2, MessageSquare, Mail, Clock, Zap, CheckCircle2, X
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

const PIPELINE_STAGES = [
  "New Leads",
  "Contacted",
  "Property Tours",
  "Fav Offers",
  "Closed Deals",
];

interface DripStep {
  day: number;
  channel: "SMS" | "Email";
  delay_label: string;
  message: string;
}

export default function WorkflowsClient({
  userEmail,
  tenantId,
  initialWorkflows,
  initialLogs,
}: {
  userEmail: string;
  tenantId: string;
  initialWorkflows: any[];
  initialLogs: any[];
}) {
  const supabase = createClient();
  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows);
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    initialWorkflows[0]?.id || null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testToast, setTestToast] = useState("");

  const [newCampaign, setNewCampaign] = useState<{
    title: string;
    trigger_stage: string;
    steps: DripStep[];
  }>({
    title: "",
    trigger_stage: "New Leads",
    steps: [
      {
        day: 0,
        channel: "SMS",
        delay_label: "Instant (0m)",
        message:
          "Hi {{first_name}}, thanks for reaching out to {{workspace_name}}! Are you looking to buy, sell, or invest in the next 90 days?",
      },
      {
        day: 2,
        channel: "Email",
        delay_label: "Day 2",
        message:
          "Hi {{first_name}}, wanted to share a few curated properties and local market stats tailored to your goals.",
      },
      {
        day: 5,
        channel: "SMS",
        delay_label: "Day 5",
        message:
          "Hey {{first_name}}, would you like to hop on a quick 10-minute call or tour a few properties this week?",
      },
    ],
  });

  const selectedWorkflow =
    workflows.find((w) => w.id === selectedWorkflowId) || workflows[0] || null;

  const handleToggleStatus = async (wf: any) => {
    const nextStatus = wf.status === "Active" ? "Paused" : "Active";
    setWorkflows((prev) =>
      prev.map((item) => (item.id === wf.id ? { ...item, status: nextStatus } : item))
    );
    await supabase.from("workflows").update({ status: nextStatus }).eq("id", wf.id);
  };

  const handleDeleteWorkflow = async (wfId: string) => {
    const remaining = workflows.filter((w) => w.id !== wfId);
    setWorkflows(remaining);
    if (selectedWorkflowId === wfId) {
      setSelectedWorkflowId(remaining[0]?.id || null);
    }
    await supabase.from("workflows").delete().eq("id", wfId);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.title.trim()) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("workflows")
      .insert([
        {
          tenant_id: tenantId,
          title: newCampaign.title.trim(),
          icon_name: "mail",
          status: "Active",
          trigger_stage: newCampaign.trigger_stage,
          triggers_count: 0,
          subtext: `On "${newCampaign.trigger_stage}"`,
          steps: newCampaign.steps,
        },
      ])
      .select()
      .single();

    setSaving(false);

    if (!error && data) {
      setWorkflows((prev) => [data, ...prev]);
      setSelectedWorkflowId(data.id);
      setIsModalOpen(false);
      setNewCampaign({
        title: "",
        trigger_stage: "New Leads",
        steps: newCampaign.steps,
      });
    }
  };

  const handleTestCampaign = async (wf: any) => {
    setTestingId(wf.id);
    setTestToast("");
    try {
      const res = await fetch("/api/workflows/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          workflowId: wf.id,
        }),
      });
      const data = await res.json();
      if (data.logs?.length > 0) {
        setLogs((prev) => [...data.logs, ...prev]);
      }
      setWorkflows((prev) =>
        prev.map((item) =>
          item.id === wf.id
            ? { ...item, triggers_count: Number(item.triggers_count || 0) + 1 }
            : item
        )
      );
      setTestToast(`Triggered Step 1 of "${wf.title}"!`);
      setTimeout(() => setTestToast(""), 3000);
    } finally {
      setTestingId(null);
    }
  };

  const updateStepField = (index: number, field: keyof DripStep, value: any) => {
    setNewCampaign((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => (idx === index ? { ...s, [field]: value } : s)),
    }));
  };

  const addStep = () => {
    setNewCampaign((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          day: (prev.steps[prev.steps.length - 1]?.day || 0) + 3,
          channel: "SMS",
          delay_label: `Day ${(prev.steps[prev.steps.length - 1]?.day || 0) + 3}`,
          message: "Hi {{first_name}}, just checking in to see if you have any questions!",
        },
      ],
    }));
  };

  return (
    <AppShell userEmail={userEmail} searchPlaceholder="Search workflows...">
      <div className="space-y-6 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Automated Drip Campaigns & Workflows</h1>
            <p className="text-sm text-gray-400">
              Automatically enroll leads into multi-step SMS & Email sequences when they enter a pipeline stage
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>New Drip Campaign</span>
          </button>
        </div>

        {testToast && (
          <div className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{testToast}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Campaign List */}
          <div className="lg:col-span-5 space-y-3">
            {workflows.map((wf) => {
              const isSelected = selectedWorkflow?.id === wf.id;
              const isActive = wf.status === "Active";
              return (
                <div
                  key={wf.id}
                  onClick={() => setSelectedWorkflowId(wf.id)}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#24282B] border-green-500/60"
                      : "bg-[#1A1D1F] border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center">
                        <Workflow size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{wf.title}</h3>
                        <p className="text-[11px] text-gray-400">
                          Trigger: <span className="text-green-400">{wf.trigger_stage || "New Leads"}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(wf);
                        }}
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer ${
                          isActive
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {isActive ? <Play size={10} /> : <Pause size={10} />}
                        <span>{wf.status}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkflow(wf.id);
                        }}
                        className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-800/80">
                    <span>{(wf.steps?.length || 3)} automated steps</span>
                    <span className="text-gray-300 font-medium">
                      {wf.triggers_count || 0} runs
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Visual Drip Sequence Timeline & Live Execution Logs */}
          <div className="lg:col-span-7 space-y-6">
            {selectedWorkflow && (
              <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-green-400" />
                      <h2 className="text-base font-semibold text-white">
                        {selectedWorkflow.title}
                      </h2>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Fires automatically when a lead enters{" "}
                      <strong className="text-green-400">
                        {selectedWorkflow.trigger_stage || "New Leads"}
                      </strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={testingId === selectedWorkflow.id}
                    onClick={() => handleTestCampaign(selectedWorkflow)}
                    className="bg-[#111315] hover:bg-gray-800 border border-gray-700 text-green-400 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    {testingId === selectedWorkflow.id ? "Running..." : "Test Sequence Now"}
                  </button>
                </div>

                {/* Sequence Steps */}
                <div className="space-y-3">
                  {(Array.isArray(selectedWorkflow.steps) && selectedWorkflow.steps.length > 0
                    ? selectedWorkflow.steps
                    : [
                        {
                          day: 0,
                          channel: "SMS",
                          delay_label: "Instant (0m)",
                          message:
                            "Hi {{first_name}}, thanks for connecting with {{workspace_name}}! How can we help with your property search?",
                        },
                      ]
                  ).map((step: DripStep, idx: number) => (
                    <div
                      key={idx}
                      className="bg-[#111315] border border-gray-800 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="bg-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded">
                            Step {idx + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 text-gray-300 font-medium">
                            {step.channel === "SMS" ? (
                              <MessageSquare size={13} className="text-green-400" />
                            ) : (
                              <Mail size={13} className="text-blue-400" />
                            )}
                            {step.channel}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-gray-400 text-[11px]">
                          <Clock size={12} />
                          {step.delay_label || `Day ${step.day}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed bg-[#1A1D1F] p-3 rounded-lg border border-gray-800/80">
                        {step.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Execution Log */}
            <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Recent Automation Activity</h3>
              {logs.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No automated messages dispatched yet. Move a lead on the Kanban board or click &ldquo;Test Sequence Now&rdquo;.
                </p>
              ) : (
                <div className="divide-y divide-gray-800 bg-[#111315] border border-gray-800 rounded-xl overflow-hidden">
                  {logs.slice(0, 8).map((log) => (
                    <div key={log.id} className="p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-200">
                          {log.lead_name || "Prospect"} • Step {log.step_index} ({log.channel})
                        </span>
                        <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded uppercase">
                          {log.status}
                        </span>
                      </div>
                      <p className="text-gray-400 truncate">{log.message_sent}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Multi-Step Drip Campaign Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-[#24282B] border border-gray-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Build Multi-Step Drip Campaign
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      required
                      value={newCampaign.title}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, title: e.target.value })
                      }
                      placeholder="e.g. New Buyer 7-Day Speed-to-Lead"
                      className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Trigger When Lead Enters Stage
                    </label>
                    <select
                      value={newCampaign.trigger_stage}
                      onChange={(e) =>
                        setNewCampaign({ ...newCampaign, trigger_stage: e.target.value })
                      }
                      className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-gray-200 outline-none focus:border-green-500"
                    >
                      {PIPELINE_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">
                      Sequence Steps (Use {"{{first_name}}"} & {"{{workspace_name}}"})
                    </span>
                    <button
                      type="button"
                      onClick={addStep}
                      className="text-xs text-green-400 hover:text-green-300 cursor-pointer"
                    >
                      + Add Step
                    </button>
                  </div>

                  {newCampaign.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="bg-[#111315] border border-gray-800 rounded-xl p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-green-400">
                          Step {idx + 1}
                        </span>
                        <select
                          value={step.channel}
                          onChange={(e) =>
                            updateStepField(
                              idx,
                              "channel",
                              e.target.value as "SMS" | "Email"
                            )
                          }
                          className="bg-[#1A1D1F] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white"
                        >
                          <option value="SMS">SMS</option>
                          <option value="Email">Email</option>
                        </select>
                        <input
                          type="text"
                          value={step.delay_label}
                          onChange={(e) =>
                            updateStepField(idx, "delay_label", e.target.value)
                          }
                          placeholder="e.g. Instant (0m) or Day 3"
                          className="bg-[#1A1D1F] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200 w-36"
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={step.message}
                        onChange={(e) =>
                          updateStepField(idx, "message", e.target.value)
                        }
                        className="w-full bg-[#1A1D1F] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
                      />
                    </div>
                  ))}
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
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    {saving ? "Saving..." : "Launch Drip Campaign"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}