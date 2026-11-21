"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, CheckCircle2, Sparkles, Home } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";

export default function PublicPropertyCapturePage() {
  const params = useParams();
  const listingId = params?.listingId as string;
  const supabase = createClient();

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submittedMsg, setSubmittedMsg] = useState("");

  useEffect(() => {
    async function loadListing() {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("id", listingId)
        .single();
      setListing(data);
      setLoading(false);
    }
    if (listingId) loadListing();
  }, [listingId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    setSubmitting(true);

    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: listing.tenant_id,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        sourceType: "property_page",
        sourceLabel: listing.address,
        estimatedValue: listing.price,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (data.success) {
      setSubmittedMsg(data.openingMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111315] text-gray-400 flex items-center justify-center">
        Loading property showcase...
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#111315] text-white flex items-center justify-center">
        Property showcase not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111315] text-white font-sans">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold">
            C
          </div>
          <span className="font-semibold tracking-wide">CloseFlow Showcase</span>
        </div>
        <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
          {listing.status}
        </span>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Property Details & Google Map */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-green-400 mb-2">
              <Home size={14} />
              <span>Featured Listing</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{listing.address}</h1>
            <div className="text-2xl font-bold text-green-400">
              ${Number(listing.price || 0).toLocaleString()}
            </div>
          </div>

          <div className="bg-[#24282B] border border-gray-800 rounded-2xl overflow-hidden h-80">
            <iframe
              title="Listing Map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                listing.address
              )}&t=m&z=15&output=embed`}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <MapPin size={14} className="text-green-500" />
            <span>Request private showing times, floorplans, and neighborhood disclosures</span>
          </div>
        </div>

        {/* Right: Lead Capture Form */}
        <div className="lg:col-span-5 bg-[#24282B] border border-gray-800 rounded-2xl p-6 sm:p-8">
          {submittedMsg ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 font-semibold">
                <CheckCircle2 size={20} />
                <span>Request Received!</span>
              </div>
              <p className="text-xs text-gray-400">
                Our AI concierge just initiated your property packet:
              </p>
              <div className="bg-[#111315] border border-green-500/30 rounded-xl p-4 text-sm text-gray-200 leading-relaxed">
                “{submittedMsg}”
              </div>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full mb-3">
                <Sparkles size={13} />
                <span>Instant Property Packet & Tour Access</span>
              </div>
              <h2 className="text-xl font-bold mb-1">Schedule a Private Tour</h2>
              <p className="text-xs text-gray-400 mb-6">
                Enter your details below for immediate photos, disclosures, and available showing times.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  placeholder="Mobile Phone (for instant SMS tour times) *"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-green-500"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {submitting ? "Sending Property Packet..." : "Unlock Full Details & Tour"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}