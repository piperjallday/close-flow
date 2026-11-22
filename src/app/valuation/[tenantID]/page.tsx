"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function PropertyValuationLandingPage() {
  const params = useParams();
  const tenantId = String(params?.tenantId || "");
  const supabase = createClient();

  const [brokerageName, setBrokerageName] = useState("CloseFlow Commercial");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [timeline, setTimeline] = useState("Within 3 months");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReply, setSubmittedReply] = useState<string | null>(null);
  const [error, setError] = useState("");

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
          inquiryNotes: `Owner valuation request (${timeline})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to request valuation");

      setSubmittedReply(data.conciergeReply);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error submitting valuation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111315] text-white flex flex-col justify-center px-6 py-12">
      <div className="max-w-xl w-full mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold px-3.5 py-1.5 rounded-full">
            <TrendingUp size={14} />
            <span>{brokerageName} • Broker Opinion of Value</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            What Is Your Property Worth in Today&apos;s Market?
          </h1>
          <p className="text-sm text-gray-400">
            Receive a custom cap-rate & comparable sales valuation prepared by our senior advisory team.
          </p>
        </div>

        <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {submittedReply ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Valuation Request Confirmed</h2>
                <p className="text-xs text-gray-400 mt-1">
                  We are compiling local comps for <strong>{propertyAddress}</strong>.
                </p>
              </div>
              <div className="bg-[#111315] border border-green-500/30 rounded-xl p-4 text-left space-y-1.5">
                <div className="text-[11px] font-semibold text-green-400 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>AI Concierge Update</span>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">{submittedReply}</p>
              </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Value Estimate ($)</label>
                  <input
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    placeholder="1450000"
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Selling / Refi Timeline</label>
                  <select
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-200 outline-none focus:border-green-500"
                  >
                    <option value="Immediately">Immediately</option>
                    <option value="Within 3 months">Within 3 months</option>
                    <option value="3-6 months">3–6 months</option>
                    <option value="Just exploring value">Just exploring value</option>
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