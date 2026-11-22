"use client";

import { useState, useEffect, useRef } from "react";

export interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface QualificationData {
  asset_type?: string | null;
  location?: string | null;
  budget?: string | null;
  timeline?: string | null;
  financing_status?: string | null;
  is_decision_maker?: boolean | null;
  summary?: string | null;
}

export interface LeadRecord {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  qualification_score?: number | null;
  qualification_data?: QualificationData | null;
  conversation_history?: ConciergeMessage[] | null;
}

interface AiConciergeDrawerProps {
  lead: LeadRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: (updated: Partial<LeadRecord> & { id: string }) => void;
}

export default function AiConciergeDrawer({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
}: AiConciergeDrawerProps) {
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [score, setScore] = useState<number>(0);
  const [status, setStatus] = useState<string>("qualifying");
  const [qualData, setQualData] = useState<QualificationData>({});
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (lead) {
      setMessages(Array.isArray(lead.conversation_history) ? lead.conversation_history : []);
      setScore(lead.qualification_score || 0);
      setStatus(lead.status || "new");
      setQualData(lead.qualification_data || {});
      setError("");
    } else {
      // Sandbox simulation mode when opened without a specific lead
      setMessages([]);
      setScore(0);
      setStatus("qualifying");
      setQualData({});
      setError("");
    }
  }, [lead, isOpen]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");
    setInputMessage("");

    const optimisticHistory: ConciergeMessage[] = [
      ...messages,
      { role: "user", content: text, timestamp: new Date().toISOString() },
    ];
    setMessages(optimisticHistory);

    try {
      const res = await fetch("/api/concierge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead?.id || null,
          leadName: lead?.name || "Prospective Buyer",
          message: text,
          history: messages,
          existingData: qualData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate AI Concierge reply");
      }

      setMessages(data.history || optimisticHistory);
      setScore(data.score ?? score);
      setStatus(data.status || status);
      setQualData(data.qualificationData || qualData);

      if (lead?.id && onLeadUpdated) {
        onLeadUpdated({
          id: lead.id,
          qualification_score: data.score,
          status: data.status,
          qualification_data: data.qualificationData,
          conversation_history: data.history,
          notes: data.qualificationData?.summary || lead.notes,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error contacting AI Concierge");
    } finally {
      setSending(false);
    }
  };

  const scoreBadgeColor =
    score >= 75
      ? "bg-green-500/20 text-green-400 border-green-500/40"
      : score >= 40
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-gray-800 text-gray-300 border-gray-700";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[#14171A] border-l border-gray-800 h-full flex flex-col text-white shadow-2xl">
        {/* Top Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-[#1A1D1F]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
                AI Concierge
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreBadgeColor}`}>
                Readiness: {score}/100
              </span>
            </div>
            <h2 className="text-lg font-semibold mt-1">
              {lead ? lead.name : "Live AI Concierge Simulator"}
            </h2>
            <p className="text-xs text-gray-400">
              {lead?.phone || lead?.email || "Test inbound buyer/tenant qualification in real time"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white bg-[#111315] border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Structured Qualification Brief */}
        <div className="p-4 bg-[#111315] border-b border-gray-800">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Extracted Deal Profile
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#1A1D1F] p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-500 block text-[10px]">Asset Class</span>
              <span className="font-medium text-gray-200">{qualData.asset_type || "Pending..."}</span>
            </div>
            <div className="bg-[#1A1D1F] p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-500 block text-[10px]">Submarket</span>
              <span className="font-medium text-gray-200">{qualData.location || "Pending..."}</span>
            </div>
            <div className="bg-[#1A1D1F] p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-500 block text-[10px]">Budget / Size</span>
              <span className="font-medium text-gray-200">{qualData.budget || "Pending..."}</span>
            </div>
            <div className="bg-[#1A1D1F] p-2.5 rounded-lg border border-gray-800">
              <span className="text-gray-500 block text-[10px]">Timeline & Capital</span>
              <span className="font-medium text-gray-200">
                {[qualData.timeline, qualData.financing_status].filter(Boolean).join(" • ") || "Pending..."}
              </span>
            </div>
          </div>
          {qualData.summary && (
            <div className="mt-2.5 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <strong className="font-semibold">Broker Brief:</strong> {qualData.summary}
            </div>
          )}
        </div>

        {/* Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-gray-500 my-10 px-6 space-y-2">
              <p className="text-gray-300 font-medium">No messages yet in this thread.</p>
              <p>
                Send a sample prospect message below (e.g.,{" "}
                <span className="text-gray-300 italic">
                  &ldquo;Hi, looking for a 10,000 sq ft warehouse near Jacksonville under $2.5M&rdquo;
                </span>
                ) to watch the AI Concierge qualify and score the lead.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isLead = msg.role === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[82%] ${
                    isLead ? "mr-auto items-start" : "ml-auto items-end"
                  }`}
                >
                  <span className="text-[10px] text-gray-500 mb-1 px-1">
                    {isLead ? lead?.name || "Prospect (Inbound)" : "CloseFlow AI Concierge"}
                  </span>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      isLead
                        ? "bg-[#22262A] text-gray-100 rounded-tl-xs border border-gray-700"
                        : "bg-green-600 text-white rounded-tr-xs"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          {sending && (
            <div className="ml-auto max-w-[70%] bg-green-600/20 border border-green-500/30 text-green-300 text-xs px-3.5 py-2 rounded-2xl">
              AI Concierge is qualifying & composing reply...
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Inbound Message Simulator Input */}
        <form onSubmit={handleSimulateInbound} className="p-4 border-t border-gray-800 bg-[#1A1D1F]">
          <label className="block text-[11px] text-gray-400 mb-1.5">
            Simulate Prospect Reply (tests AI Concierge + updates score)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a prospect SMS message..."
              className="flex-1 bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-green-500"
            />
            <button
              type="submit"
              disabled={sending || !inputMessage.trim()}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}