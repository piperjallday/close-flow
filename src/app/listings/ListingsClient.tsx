"use client";

import { useState } from "react";
import { geocodeAddress } from "../../lib/geocode";
import dynamic from "next/dynamic";
import { Plus, Trash2, Home, BedDouble, Bath, X } from "lucide-react";
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

const LISTING_STATUSES = ["For Sale", "Under Contract", "Sold"];

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
  const [newListing, setNewListing] = useState({
    address: "",
    price: "",
    beds: "3",
    baths: "2",
    status: "For Sale",
    tag: "New",
  });

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListing.address.trim()) return;
    setIsSaving(true);

    const offset = (listings.length + 1) * 0.012;
    const { data, error } = await supabase
      .from("listings")
      .insert([
        {
          address: newListing.address.trim(),
          price: Number(newListing.price) || 0,
          beds: Number(newListing.beds) || 0,
          baths: Number(newListing.baths) || 0,
          status: newListing.status,
          tag: newListing.tag.trim() || "New",
          latitude: 30.3322 + offset,
          longitude: -81.6557 - offset,
        },
      ])
      .select()
      .single();

    setIsSaving(false);
    if (!error && data) {
      setListings((prev) => [data, ...prev]);
      setSelectedListingId(data.id);
      setNewListing({
        address: "",
        price: "",
        beds: "3",
        baths: "2",
        status: "For Sale",
        tag: "New",
      });
      setIsModalOpen(false);
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
            Click any property card or map pin to inspect inventory
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

      {/* Property Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => {
          const isSelected = item.id === selectedListingId;
          return (
            <div
              key={item.id}
              onClick={() => setSelectedListingId(item.id)}
              className={`bg-[#24282B] border rounded-xl p-5 flex flex-col justify-between transition-colors cursor-pointer ${
                isSelected
                  ? "border-green-500"
                  : "border-gray-800 hover:border-gray-700"
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Home size={18} className="text-green-500 shrink-0" />
                    <span>{item.address}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1 rounded cursor-pointer"
                    title="Delete listing"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="text-2xl font-bold text-green-400 mb-3">
                  ${Number(item.price).toLocaleString()}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-5">
                  <span className="flex items-center gap-1">
                    <BedDouble size={14} /> {item.beds} Beds
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath size={14} /> {item.baths} Baths
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded">
                  {item.tag}
                </span>
                <select
                  value={item.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleStatusChange(item.id, e.target.value)}
                  className="bg-[#111315] text-gray-200 text-xs border border-gray-700 rounded-lg px-2.5 py-1.5 outline-none focus:border-green-500 cursor-pointer"
                >
                  {LISTING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Property Listing</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddListing} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Property Address *"
                value={newListing.address}
                onChange={(e) =>
                  setNewListing({ ...newListing, address: e.target.value })
                }
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  required
                  placeholder="Price ($)"
                  value={newListing.price}
                  onChange={(e) =>
                    setNewListing({ ...newListing, price: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <input
                  type="number"
                  placeholder="Beds"
                  value={newListing.beds}
                  onChange={(e) =>
                    setNewListing({ ...newListing, beds: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Baths"
                  value={newListing.baths}
                  onChange={(e) =>
                    setNewListing({ ...newListing, baths: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newListing.status}
                  onChange={(e) =>
                    setNewListing({ ...newListing, status: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                >
                  {LISTING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Tag (New, Featured)"
                  value={newListing.tag}
                  onChange={(e) =>
                    setNewListing({ ...newListing, tag: e.target.value })
                  }
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
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
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}