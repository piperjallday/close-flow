"use client";

import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";

interface Listing {
  id: string;
  address: string;
  price: number;
  beds: number;
  baths: number;
  status: string;
  tag: string;
}

interface ListingsMapProps {
  listings: Listing[];
  selectedListingId: string | null;
  onSelectListing?: (id: string) => void;
}

export default function ListingsMap({
  listings,
  selectedListingId,
}: ListingsMapProps) {
  const [mapType, setMapType] = useState<"m" | "k">("m"); // 'm' = Roadmap, 'k' = Satellite

  const activeListing =
    listings.find((l) => l.id === selectedListingId) || listings[0];

  if (!activeListing) {
    return (
      <div className="w-full h-full min-h-[260px] bg-[#1A1D1F] flex flex-col items-center justify-center text-gray-500 text-xs p-4">
        <MapPin size={24} className="mb-2 text-gray-600" />
        <span>Add a listing with a street address to view it on Google Maps</span>
      </div>
    );
  }

  const encodedAddress = encodeURIComponent(activeListing.address);
  const googleMapsEmbedUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=${mapType}&z=15&ie=UTF8&iwloc=&output=embed`;
  const googleMapsExternalUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

  return (
    <div className="w-full h-full min-h-[260px] relative bg-[#111315] overflow-hidden">
      {/* Top Overlay Bar: Map/Satellite Toggle & Open in Google Maps */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 bg-[#111315]/90 backdrop-blur-xs border border-gray-700 rounded-lg p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setMapType("m")}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
            mapType === "m"
              ? "bg-green-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapType("k")}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
            mapType === "k"
              ? "bg-green-600 text-white"
              : "text-gray-300 hover:text-white"
          }`}
        >
          Satellite
        </button>
        <a
          href={googleMapsExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Google Maps"
          className="p-1 text-gray-400 hover:text-white transition-colors"
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Live Google Maps Iframe */}
      <iframe
        key={`${activeListing.id}-${mapType}`}
        title={`Google Map for ${activeListing.address}`}
        src={googleMapsEmbedUrl}
        className="w-full h-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      {/* Bottom Property Pill Overlay */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 pointer-events-none flex justify-between items-end">
        <div className="bg-[#111315]/95 backdrop-blur-xs border border-gray-700 rounded-lg px-3 py-2 shadow-xl max-w-[85%]">
          <div className="text-xs font-semibold text-white truncate">
            {activeListing.address}
          </div>
          <div className="text-[11px] text-green-400 font-medium">
            ${Number(activeListing.price || 0).toLocaleString()} •{" "}
            {activeListing.beds} bd / {activeListing.baths} ba ({activeListing.status})
          </div>
        </div>
      </div>
    </div>
  );
}