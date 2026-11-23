"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus, Trash2, Share2, Image as ImageIcon, Sparkles } from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

const ListingsMap = dynamic(() => import("../../components/ListingsMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#1A1D1F] rounded-xl flex items-center justify-center text-xs text-gray-500">
      Loading interactive map...
    </div>
  ),
});

export default function ListingsClient({
  userEmail,
  initialListings,
}: {
  userEmail: string;
  initialListings: any[];
}) {
  const supabase = createClient();
  const [listings, setListings] = useState(initialListings);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    initialListings[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const [newListing, setNewListing] = useState({
    address: "",
    price: "",
    beds: "3",
    baths: "2",
    sqft: "",
    status: "For Sale",
    tag: "New",
    description: "",
    imageUrls: "", // Multi-photo input
    autoPostSocial: false, // 1-Click Social Publish Toggle
  });

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListing.address.trim()) return;
    setIsSaving(true);
    setSaveStatus("Saving property to database...");

    try {
      // 1. Parse photo URLs
      const parsedPhotos = newListing.imageUrls
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);
      
      const primaryPhoto = parsedPhotos[0] || null;

      // 2. Get user's tenant ID
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user?.id)
        .single();
        
      const tenantId = profile?.tenant_id;

      // 3. Save Listing to Supabase
      const offset = (listings.length + 1) * 0.012;
      const { data: savedListing, error } = await supabase
        .from("listings")
        .insert([
          {
            tenant_id: tenantId,
            address: newListing.address.trim(),
            price: Number(newListing.price) || 0,
            beds: Number(newListing.beds) || 0,
            baths: Number(newListing.baths) || 0,
            sqft: Number(newListing.sqft) || 0,
            status: newListing.status,
            tag: newListing.tag.trim() || "New",
            description: newListing.description.trim() || null,
            image_url: primaryPhoto,
            image_urls: parsedPhotos,
            latitude: 30.3322 + offset,
            longitude: -81.6557 - offset,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // 4. Handle Auto-Post to Social Media if checked
      if (newListing.autoPostSocial && savedListing) {
        setSaveStatus("AI is writing social posts...");
        const captureUrl = `${window.location.origin}/p/${savedListing.id}`;
        
        // Generate AI Captions
        const genRes = await fetch("/api/social/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: savedListing.address,
            price: savedListing.price,
            beds: savedListing.beds,
            baths: savedListing.baths,
            sqft: savedListing.sqft,
            tag: savedListing.tag,
            description: savedListing.description,
            captureUrl,
          }),
        });
        
        if (genRes.ok) {
          const genData = await genRes.json();
          const posts = genData.posts;
          
          setSaveStatus("Publishing to connected platforms...");
          
          // Publish to configured platforms (Facebook, Instagram, LinkedIn, Webhook)
          const platforms = ["facebook", "instagram", "linkedin", "tiktok"];
          
          for (const platform of platforms) {
            if (posts[platform]) {
              await fetch("/api/social/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  tenantId,
                  listingId: savedListing.id,
                  platform,
                  caption: posts[platform],
                  captureUrl,
                  mediaUrl: primaryPhoto,
                }),
              }).catch(console.error); // Fire and forget for speed
            }
          }
        }
      }

      setListings((prev) => [savedListing, ...prev]);
      setSelectedListingId(savedListing.id);
      
      // Reset Form
      setNewListing({
        address: "",
        price: "",
        beds: "3",
        baths: "2",
        sqft: "",
        status: "For Sale",
        tag: "New",
        description: "",
        imageUrls: "",
        autoPostSocial: false,
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving listing:", err);
      alert("Failed to save listing. Please try again.");
    } finally {
      setIsSaving(false);
      setSaveStatus("");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const tag =
      status === "Sold"
        ? "Sold"
        : status === "Under Contract"
        ? "Under Contract"
        : "Active";
    setListings((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status, tag } : item))
    );
    await supabase.from("listings").update({ status, tag }).eq("id", id);
  };

  const handleDelete = async (id: string) => {
    const updated = listings.filter((item) => item.id !== id);
    setListings(updated);
    if (selectedListingId === id) {
      setSelectedListingId(updated[0]?.id || null);
    }
    await supabase.from("listings").delete().eq("id", id);
  };

  const filtered = listings.filter((item) =>
    item.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell
      userEmail={userEmail}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder="Search properties by address..."
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Property Listings</h1>
          <p className="text-sm text-gray-400">
            Manage inventory and unlock automated social media marketing
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={16} />
          <span>Add Listing</span>
        </button>
      </div>

      {/* Interactive Map Banner */}
      <div className="h-96 w-full bg-[#24282B] border border-gray-800 rounded-xl overflow-hidden mb-6 relative">
        <ListingsMap
          listings={filtered}
          selectedListingId={selectedListingId}
          onSelectListing={(id) => setSelectedListingId(id)}
        />
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedListingId(item.id)}
            className={`bg-[#24282B] border rounded-xl overflow-hidden cursor-pointer transition-all ${
              selectedListingId === item.id
                ? "border-green-500 ring-1 ring-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                : "border-gray-800 hover:border-gray-600"
            }`}
          >
            <div className="h-48 bg-[#1A1D1F] relative">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt={item.address}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-xs">No Photo Available</span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded border border-gray-700">
                {item.tag || "New"}
              </div>
              {Array.isArray(item.image_urls) && item.image_urls.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded border border-gray-700 flex items-center gap-1">
                  <ImageIcon size={12} />
                  {item.image_urls.length} Photos
                </div>
              )}
            </div>
            
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-gray-100 leading-tight">
                  {item.address}
                </h3>
                <span className="text-green-400 font-bold whitespace-nowrap">
                  ${Number(item.price).toLocaleString()}
                </span>
              </div>
              
              <div className="text-xs text-gray-400 flex items-center gap-3">
                <span>{item.beds} Beds</span>
                <span>•</span>
                <span>{item.baths} Baths</span>
                {item.sqft && (
                  <>
                    <span>•</span>
                    <span>{Number(item.sqft).toLocaleString()} SqFt</span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <select
                  value={item.status}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleStatusChange(item.id, e.target.value);
                  }}
                  className={`text-[11px] font-medium px-2 py-1 rounded border outline-none cursor-pointer ${
                    item.status === "Sold"
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : item.status === "Under Contract"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                      : "bg-green-500/10 text-green-400 border-green-500/30"
                  }`}
                >
                  <option value="For Sale" className="bg-[#1A1D1F]">For Sale</option>
                  <option value="Under Contract" className="bg-[#1A1D1F]">Under Contract</option>
                  <option value="Sold" className="bg-[#1A1D1F]">Sold</option>
                </select>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="Copy Capture Page Link"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${window.location.origin}/p/${item.id}`);
                      alert("Property Capture Link Copied!");
                    }}
                    className="text-gray-400 hover:text-green-400 p-1.5 transition-colors"
                  >
                    <Share2 size={15} />
                  </button>
                  <button
                    type="button"
                    title="Delete Listing"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this listing?")) handleDelete(item.id);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1.5 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500 text-sm">
            No properties found matching your search.
          </div>
        )}
      </div>

      {/* Add New Listing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1A1D1F] border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-semibold mb-1">Add New Listing</h2>
            <p className="text-xs text-gray-400 mb-5">
              Enter property details to unlock its capture page and photo gallery.
            </p>
            <form onSubmit={handleAddListing} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 123 Main St, Jacksonville, FL"
                  value={newListing.address}
                  onChange={(e) =>
                    setNewListing({ ...newListing, address: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price ($)</label>
                  <input
                    type="number"
                    placeholder="450000"
                    value={newListing.price}
                    onChange={(e) =>
                      setNewListing({ ...newListing, price: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Beds</label>
                  <input
                    type="number"
                    value={newListing.beds}
                    onChange={(e) =>
                      setNewListing({ ...newListing, beds: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Baths</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newListing.baths}
                    onChange={(e) =>
                      setNewListing({ ...newListing, baths: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">SqFt</label>
                  <input
                    type="number"
                    placeholder="2200"
                    value={newListing.sqft}
                    onChange={(e) =>
                      setNewListing({ ...newListing, sqft: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Status</label>
                  <select
                    value={newListing.status}
                    onChange={(e) =>
                      setNewListing({ ...newListing, status: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="For Sale">For Sale</option>
                    <option value="Under Contract">Under Contract</option>
                    <option value="Sold">Sold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Label Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. New, Featured, Price Cut"
                    value={newListing.tag}
                    onChange={(e) =>
                      setNewListing({ ...newListing, tag: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Broker Notes & Description</label>
                <textarea
                  rows={2}
                  placeholder="Key features, neighborhood perks, updates..."
                  value={newListing.description}
                  onChange={(e) =>
                    setNewListing({ ...newListing, description: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Photo URLs (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="https://image.com/hero.jpg&#10;https://image.com/kitchen.jpg"
                  value={newListing.imageUrls}
                  onChange={(e) =>
                    setNewListing({ ...newListing, imageUrls: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-white outline-none focus:border-green-500 leading-relaxed font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  The first photo will be public. All other photos remain locked until the buyer completes the lead capture form on your property link.
                </p>
              </div>

              {/* 1-Click Social Media Auto-Post Toggle */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 bg-[#111315] border border-purple-500/30 rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={newListing.autoPostSocial}
                    onChange={(e) =>
                      setNewListing({ ...newListing, autoPostSocial: e.target.checked })
                    }
                    className="mt-1 flex-shrink-0 accent-purple-500 w-4 h-4"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
                      <Sparkles size={14} className="text-purple-400" />
                      Auto-Post to Connected Social Accounts
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                      AI will automatically write optimized captions (Facebook, X, LinkedIn, TikTok, IG) embedding your lead-capture link, and publish them instantly to any APIs configured in Workspace Settings.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-5 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-colors disabled:opacity-70"
                >
                  {isSaving ? saveStatus || "Saving..." : "Save & Generate Links"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}