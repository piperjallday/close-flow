"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Building2, MapPin, CheckCircle2, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function PublicPropertyLandingPage() {
  const params = useParams();
  const listingId = String(params?.listingID || params?.id || "");
  const supabase = createClient();

  const [listing, setListing] = useState<any | null>(null);
  const [brokerageName, setBrokerageName] = useState("CloseFlow Real Estate");
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inquiryNotes, setInquiryNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedReply, setSubmittedReply] = useState<string | null>(null);
  const [error, setError] = useState("");

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
          inquiryNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to submit request");

      setSubmittedReply(data.conciergeReply);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
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
          <div className="w-8 h-8 rounded-full bg-green-500 text-black font-bold flex items-center justify-center">
            C
          </div>
          <span className="font-semibold tracking-wide">{brokerageName}</span>
        </div>
        <span className="text-xs bg-green-500/15 border border-green-500/30 text-green-400 px-3 py-1 rounded-full font-medium">
          {listing.status || "Available"}
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Property Highlights */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#1A1D1F] border border-gray-800 text-xs text-green-400 px-3 py-1.5 rounded-full">
            <Building2 size={14} />
            <span>Exclusive Property • {listing.tag || "Featured"}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            {listing.address}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
            <span className="text-2xl font-bold text-green-400">
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
          </div>

          <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MapPin size={16} className="text-green-400" />
              <span>Property Package & Private Showing Access</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Request the complete property packet, floor plans, disclosures, or schedule a private tour. Our AI Concierge will connect you directly with our listing advisor.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Status</div>
                <div className="font-semibold text-gray-200 mt-0.5">{listing.status}</div>
              </div>
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Response Time</div>
                <div className="font-semibold text-green-400 mt-0.5">&lt; 60 Seconds</div>
              </div>
              <div className="bg-[#111315] border border-gray-800 rounded-xl p-3">
                <div className="text-gray-500">Represented By</div>
                <div className="font-semibold text-gray-200 mt-0.5 truncate">{brokerageName}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Lead Capture Funnel Card */}
        <div className="lg:col-span-5 bg-[#1A1D1F] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {submittedReply ? (
            <div className="space-y-5 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Request Received!</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Your inquiry has been routed to {brokerageName}.
                </p>
              </div>
              <div className="bg-[#111315] border border-green-500/30 rounded-xl p-4 text-left space-y-1.5">
                <div className="text-[11px] font-semibold text-green-400 flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>AI Concierge Instant Response</span>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">{submittedReply}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-white">Request Info & Private Tour</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Get instant access to property details and showing availability.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg">
                  {error}
                </div>
              )}

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
                <label className="block text-xs text-gray-400 mb-1">Mobile Phone (for SMS updates) *</label>
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
                <label className="block text-xs text-gray-400 mb-1">Timeline / Questions</label>
                <textarea
                  rows={2}
                  value={inquiryNotes}
                  onChange={(e) => setInquiryNotes(e.target.value)}
                  placeholder="e.g. Looking to tour this week or close within 30–60 days..."
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{submitting ? "Sending Request..." : "Get Property Details"}</span>
                <ArrowRight size={16} />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 pt-1">
                <ShieldCheck size={13} className="text-green-500" />
                <span>Instant AI Concierge scheduling • Zero spam</span>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}