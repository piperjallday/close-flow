"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Building2, MapPin, CheckCircle2, Sparkles, ArrowRight, ShieldCheck, Maximize2, Send
} from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function PublicPropertyLandingPage() {
  const params = useParams();
  const listingId = String(params?.listingId || params?.listingID || params?.id || "");
  const supabase = createClient();

  const [listing, setListing] = useState<any | null>(null);
  const [brokerageName, setBrokerageName] = useState("CloseFlow Real Estate");
  const [loading, setLoading] = useState(true);

  // Step 1 Quick Qualification Pills (Low-Friction Micro-Commitment)
  const [moveTimeline, setMoveTimeline] = useState("Within 30–60 days");
  const [preApproved, setPreApproved] = useState("Yes, Pre-Approved");

  // Step 2 Contact Info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inquiryNotes, setInquiryNotes] = useState("");
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
    async function fetchListing() {
      if (!listingId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("listings")
        .select("*, tenants(name)")
        .eq("id", listingId)
        .single();

      if (data) {
        setListing(data);
        const tenantObj = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;
        if (tenantObj?.name) setBrokerageName(tenantObj.name);
      }
      setLoading(false);
    }
    fetchListing();
  }, [listingId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !listing) return;

    setSubmitting(true);
    setError("");

    const combinedNotes = `Timeline: ${moveTimeline} | Financing: ${preApproved}${
      inquiryNotes.trim() ? ` | Notes: ${inquiryNotes.trim()}` : ""
    }`;

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: listing.tenant_id || "",
          listingId: listing.id,
          fullName,
          email,
          phone,
          sourceType: "Property Capture",
          propertyAddress: listing.address,
          estimatedValue: listing.price,
          inquiryNotes: combinedNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit request");

      setCreatedLeadId(data.leadId || null);
      setChatHistory([
        {
          role: "assistant",
          content:
            data.conciergeReply ||
            `Thanks ${fullName.split(" ")[0]}! When would you like to tour ${listing.address}?`,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendChat = async (quickText?: string) => {
    const msg = (quickText ?? chatInput).trim();
    if (!msg || !createdLeadId || sendingChat) return;

    const nextHistory = [...chatHistory, { role: "user" as const, content: msg }];
    setChatHistory(nextHistory);
    setChatInput("");
    setSendingChat(true);

    try {
      const res = await fetch("/api/concierge/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: createdLeadId,
          tenantId: listing?.tenant_id || "",
          message: msg,
          history: nextHistory,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111315] text-white flex items-center justify-center text-sm text-gray-400">
        Loading property details...
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#111315] text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Listing Unavailable</h1>
        <p className="text-sm text-gray-400">This property link may have expired or been removed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111315] text-white flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-green-600 text-white font-bold flex items-center justify-center">
            {brokerageName.charAt(0)}
          </div>
          <span className="font-semibold tracking-wide">{brokerageName}</span>
        </div>
        <span className="text-xs bg-green-500/15 border border-green-500/30 text-gray-100 px-3 py-1 rounded-full font-medium">
          {listing.status || "Available"}
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Property Hero + Highlights */}
        <div className="lg:col-span-7 space-y-6">
          {listing.image_url ? (
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#1A1D1F] aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.image_url}
                alt={listing.address}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs border border-gray-700 text-xs text-gray-100 px-3 py-1 rounded-full font-medium">
                {listing.tag || "Featured Property"}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-[#1A1D1F] border border-gray-800 text-xs text-gray-200 px-3 py-1.5 rounded-full">
              <Building2 size={14} />
              <span>Exclusive Property • {listing.tag || "Featured"}</span>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            {listing.address}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
            <span className="text-2xl font-bold text-white">
              ${Number(listing.price || 0).toLocaleString()}
            </span>
            {Number(listing.beds) > 0 && (
              <>
                <span className="text-gray-600">•</span>
                <span>{listing.beds} Beds / Units</span>
              </>
            )}
            {Number(listing.baths) > 0 && (
              <>
                <span className="text-gray-600">•</span>
                <span>{listing.baths} Baths</span>
              </>
            )}
            {Number(listing.sqft) > 0 && (
              <>
                <span className="text-gray-600">•</span>
                <span className="inline-flex items-center gap-1">
                  <Maximize2 size={13} className="text-gray-400" />
                  {Number(listing.sqft).toLocaleString()} SqFt
                </span>
              </>
            )}
          </div>

          <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MapPin size={16} />
              <span>Property Overview & Private Showing Access</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {listing.description ||
                "Request the complete property packet, floor plans, seller disclosures, or lock in a private showing time. Our AI Concierge responds in seconds."}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Status</div>
                <div className="font-semibold text-gray-200 mt-0.5">{listing.status}</div>
              </div>
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Tour Confirmation</div>
                <div className="font-semibold text-gray-100 mt-0.5">&lt; 60 Seconds</div>
              </div>
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Represented By</div>
                <div className="font-semibold text-gray-200 mt-0.5 truncate">{brokerageName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 2-Step Qualification Funnel + Live Post-Submit AI Concierge Chat */}
        <div className="lg:col-span-5 bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl sticky top-8">
          {chatHistory.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-gray-800">
                <div className="w-9 h-9 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Live AI Concierge • {brokerageName}
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Reply below to lock in your showing time or request disclosures
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
                        <span>Concierge</span>
                      </div>
                    )}
                    {m.content}
                  </div>
                ))}
              </div>

              {/* One-Tap Tour & Financing Quick Replies */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Schedule a tour this weekend",
                  "Send seller disclosures",
                  "Connect me with your lender",
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
                  placeholder="Type a day/time or question..."
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
              <div>
                <h2 className="text-xl font-bold text-white">Request Info & Private Tour</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Customize your inquiry below for instant showing availability.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Step 1: Micro-Commitment Qualification Pills */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Move Timeframe</label>
                  <select
                    value={moveTimeline}
                    onChange={(e) => setMoveTimeline(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-green-500"
                  >
                    <option value="ASAP (Under 30 days)">ASAP (&lt; 30 days)</option>
                    <option value="Within 30–60 days">30–60 days</option>
                    <option value="3–6 months">3–6 months</option>
                    <option value="Just browsing">Just browsing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Financing Status</label>
                  <select
                    value={preApproved}
                    onChange={(e) => setPreApproved(e.target.value)}
                    className="w-full bg-[#111315] border border-gray-700 rounded-xl px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-green-500"
                  >
                    <option value="Yes, Pre-Approved">Pre-Approved</option>
                    <option value="Cash Buyer">Cash Buyer</option>
                    <option value="Not pre-approved yet">Need Pre-Approval</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Mobile Phone (for SMS tour alerts) *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(904) 555-0148"
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
                  placeholder="alex@email.com"
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Preferred Tour Day / Questions</label>
                <textarea
                  rows={2}
                  value={inquiryNotes}
                  onChange={(e) => setInquiryNotes(e.target.value)}
                  placeholder="e.g. Available Saturday morning or weekday after 5pm..."
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{submitting ? "Unlocking Details..." : "Unlock Details & Schedule Tour"}</span>
                <ArrowRight size={16} />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 pt-1">
                <ShieldCheck size={13} />
                <span>Instant AI Concierge scheduling • Zero spam</span>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}