"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, CheckCircle2, Sparkles, ArrowRight, Send } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function PropertyValuationLandingPage() {
  const params = useParams();
  const tenantId = String(params?.tenantID || params?.tenantId || "");
  const supabase = createClient();

  const [brokerageName, setBrokerageName] = useState("CloseFlow Real Estate");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyCondition, setPropertyCondition] = useState("Turnkey / Updated");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [timeline, setTimeline] = useState("Within 3 months");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Post-Submit Live AI Concierge Chat State
  const [createdLeadId, setCreatedLeadId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    async function loadTenant() {
      if (!tenantId) return;
      const { data } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();
      if (data?.name) setBrokerageName(data.name);
    }
    loadTenant();
  }, [tenantId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyAddress.trim() || !fullName.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          fullName,
          email,
          phone,
          sourceType: "Valuation Funnel",
          propertyAddress,
          estimatedValue: Number(estimatedValue) || 0,
          inquiryNotes: `Seller valuation request (${timeline}, Condition: ${propertyCondition})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request valuation");

      setCreatedLeadId(data.leadId || null);
      setChatHistory([
        {
          role: "assistant",
          content:
            data.conciergeReply ||
            `Hi ${fullName.split(" ")[0]}! Thanks for requesting a home valuation for ${propertyAddress} with ${brokerageName}. Just to confirm we have the right address—are you looking to just sell ${propertyAddress}, or are you planning to buy your next home as well?`,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error submitting valuation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendChat = async (quickText?: string) => {
    const msg = (quickText ?? chatInput).trim();
    if (!msg || !createdLeadId || sendingChat) return;

    const priorHistory = [...chatHistory];
    const nextHistory = [...priorHistory, { role: "user" as const, content: msg }];
    setChatHistory(nextHistory);
    setChatInput("");
    setSendingChat(true);

    try {
      const res = await fetch("/api/concierge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: createdLeadId,
          tenantId,
          message: msg,
          history: priorHistory,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
      }
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111315] text-white flex flex-col justify-center px-6 py-12">
      <div className="max-w-xl w-full mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 text-gray-100 text-xs font-semibold px-3.5 py-1.5 rounded-full">
            <TrendingUp size={14} />
            <span>{brokerageName} • Home Value Estimate</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            What Is Your Property Worth in Today&apos;s Market?
          </h1>
          <p className="text-sm text-gray-400">
            Receive a custom comparable sales &amp; net-proceeds breakdown prepared by someone from our team.
          </p>
        </div>

        <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {chatHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
                <div className="w-9 h-9 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Valuation Confirmed • {propertyAddress}
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Chat with our AI Concierge to set up your review with someone from our team
                  </p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                {chatHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-xs leading-relaxed ${
                      m.role === "assistant"
                        ? "bg-[#111315] border border-gray-800 text-gray-200"
                        : "bg-green-600 text-white ml-6"
                    }`}
                  >
                    {m.role === "assistant" && (
                      <div className="text-[10px] font-semibold text-gray-400 mb-1 flex items-center gap-1">
                        <Sparkles size={11} />
                        <span>{brokerageName} Concierge</span>
                      </div>
                    )}
                    {m.content}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "Yes, I'm also buying next",
                  "Phone call",
                  "Meet in person",
                  "Google Meet / Zoom call",
                  "Send recent neighborhood comps",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSendChat(chip)}
                    disabled={sendingChat}
                    className="text-[11px] bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-200 px-2.5 py-1 rounded-full cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex gap-2 pt-1"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a day, time, or meeting preference..."
                  className="flex-1 bg-[#111315] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-green-500"
                />
                <button
                  type="submit"
                  disabled={sendingChat || !chatInput.trim()}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send size={13} />
                </button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1">Property Street Address *</label>
                <input
                  type="text"
                  required
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  placeholder="1200 Riverplace Blvd, Jacksonville, FL"
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Property Condition</label>
                  <select
                    value={propertyCondition}
                    onChange={(e) => setPropertyCondition(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-green-500"
                  >
                    <option value="Turnkey / Updated">Turnkey / Updated</option>
                    <option value="Good / Move-In Ready">Move-In Ready</option>
                    <option value="Needs Minor Updates">Needs Minor TLC</option>
                    <option value="Full Renovation">Fixer / Value-Add</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Est. Value ($)</label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="650000"
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Selling Timeline</label>
                  <select
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-gray-200 outline-none focus:border-green-500"
                  >
                    <option value="Immediately">Immediately</option>
                    <option value="Within 3 months">Within 3 months</option>
                    <option value="3-6 months">3–6 months</option>
                    <option value="Just exploring value">Just exploring</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Owner / Contact Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Morgan Vance"
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(904) 555-0192"
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="morgan@vanceholdings.com"
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{submitting ? "Generating Report..." : "Request Free Property Valuation"}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}