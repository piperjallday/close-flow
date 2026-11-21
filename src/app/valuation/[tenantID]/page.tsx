"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TrendingUp, CheckCircle2, MapPin } from "lucide-react";

export default function PublicHomeValuationPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const [step, setStep] = useState<1 | 2>(1);
  const [address, setAddress] = useState("");
  const [beds, setBeds] = useState("3");
  const [sqft, setSqft] = useState("2100");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [aiGreeting, setAiGreeting] = useState("");

  const handleCalculateAndCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Compliant AVM baseline calculation from user property inputs
    const computedEstimate =
      Math.round((Number(sqft || 1800) * 235 + Number(beds || 3) * 18000) / 1000) *
      1000;

    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        sourceType: "home_valuation",
        sourceLabel: `Home Valuation (${address})`,
        estimatedValue: computedEstimate,
        addressInput: address,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (data.success) {
      setEstimate(computedEstimate);
      setAiGreeting(data.openingMessage);
    }
  };

  return (
    <div className="min-h-screen bg-[#111315] text-white font-sans flex flex-col justify-between">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold">
            C
          </div>
          <span className="font-semibold">CloseFlow Home Equity Report</span>
        </div>
        <span className="text-xs text-green-400 font-medium">Instant Market Estimate</span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-14 w-full">
        <div className="bg-[#24282B] border border-gray-800 rounded-2xl p-8">
          {estimate ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                <CheckCircle2 size={18} />
                <span>Your Automated Home Value Report</span>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <MapPin size={13} className="text-green-400" />
                <span>{address}</span>
              </div>

              <div className="bg-[#111315] border border-green-500/30 rounded-xl p-6 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                  Estimated Market Range
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-green-400">
                  ${(estimate - 18000).toLocaleString()} – ${(estimate + 22000).toLocaleString()}
                </div>
              </div>

              {aiGreeting && (
                <div className="bg-[#1A1D1F] border border-gray-800 rounded-xl p-4 text-xs text-gray-300 leading-relaxed">
                  {aiGreeting}
                </div>
              )}

              <p className="text-[11px] text-gray-500 leading-relaxed">
                *Disclaimer: Automated valuation range is an informational estimate based on
                property specifications and regional averages, not a licensed appraisal or
                live MLS comparative market analysis.
              </p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-5">
              <div className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-full">
                <TrendingUp size={14} />
                <span>Free Instant Home Valuation</span>
              </div>
              <h1 className="text-2xl font-bold">What Is Your Home Worth Today?</h1>
              <p className="text-xs text-gray-400">
                Enter your property address and basic details to generate an instant equity &
                neighborhood demand estimate.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Enter Street Address, City, State *"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Bedrooms</label>
                    <input
                      type="number"
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Approx. Sq Ft</label>
                    <input
                      type="number"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-green-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!address.trim()}
                  onClick={() => setStep(2)}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Calculate My Home Value
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCalculateAndCapture} className="space-y-4">
              <h2 className="text-xl font-bold">Where Should We Send Your Report?</h2>
              <p className="text-xs text-gray-400">
                Your valuation for <span className="text-white">{address}</span> is ready.
              </p>
              <input
                type="text"
                required
                placeholder="Full Name *"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full bg-[#111315] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500"
              />
              <input
                type="email"
                required
                placeholder="Email Address *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[#111315] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500"
              />
              <input
                type="tel"
                required
                placeholder="Mobile Phone *"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-[#111315] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
              >
                {submitting ? "Generating Report..." : "Reveal My Home Value"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}