"use client";

import { useState, useEffect } from "react";
import {
  X, Sparkles, Copy, Check, QrCode, Send, ExternalLink, Calendar, Download
} from "lucide-react";

type PlatformKey = "facebook" | "instagram" | "linkedin" | "youtube" | "tiktok";

const PLATFORMS: { key: PlatformKey; label: string; badge: string; launchUrl: string }[] = [
  {
    key: "facebook",
    label: "Facebook",
    badge: "Feed & Groups",
    launchUrl: "https://www.facebook.com/sharer/sharer.php",
  },
  {
    key: "instagram",
    label: "Instagram",
    badge: "Post & Reels",
    launchUrl: "https://www.instagram.com/",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    badge: "Network Post",
    launchUrl: "https://www.linkedin.com/feed/",
  },
  {
    key: "youtube",
    label: "YouTube Shorts",
    badge: "30s Video Script",
    launchUrl: "https://studio.youtube.com/",
  },
  {
    key: "tiktok",
    label: "TikTok",
    badge: "Viral Tour Script",
    launchUrl: "https://www.tiktok.com/upload",
  },
];

interface SocialAutoposterModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  brokerageName?: string;
  listing: {
    id?: string;
    address: string;
    price?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    tag?: string;
    description?: string;
    image_url?: string;
  } | null;
}

export default function SocialAutoposterModal({
  isOpen,
  onClose,
  tenantId,
  brokerageName = "CloseFlow Real Estate",
  listing,
}: SocialAutoposterModalProps) {
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("facebook");
  const [posts, setPosts] = useState<Record<PlatformKey, string>>({
    facebook: "",
    instagram: "",
    linkedin: "",
    youtube: "",
    tiktok: "",
  });
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://closeflow.app";
  const captureUrl = listing?.id
    ? `${origin}/p/${listing.id}`
    : `${origin}/valuation/${tenantId}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    captureUrl
  )}`;

  useEffect(() => {
    if (!isOpen || !listing) return;

    async function generateCopy() {
      setGenerating(true);
      setStatusNotice("");
      try {
        const res = await fetch("/api/social/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: listing?.address,
            price: listing?.price,
            beds: listing?.beds,
            baths: listing?.baths,
            sqft: listing?.sqft,
            tag: listing?.tag,
            description: listing?.description,
            captureUrl,
            brokerageName,
          }),
        });
        const data = await res.json();
        if (data.posts) {
          setPosts(data.posts);
        }
      } finally {
        setGenerating(false);
      }
    }

    generateCopy();
  }, [isOpen, listing, captureUrl, brokerageName]);

  if (!isOpen || !listing) return null;

  const currentCaption = posts[activePlatform] || "";
  const activeMeta = PLATFORMS.find((p) => p.key === activePlatform)!;

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAutopost = async (openExternal = false) => {
    setPublishing(true);
    setStatusNotice("");
    try {
      navigator.clipboard.writeText(currentCaption);

      const res = await fetch("/api/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          listingId: listing.id || null,
          platform: activePlatform,
          caption: currentCaption,
          videoScript:
            activePlatform === "youtube" || activePlatform === "tiktok"
              ? currentCaption
              : null,
          captureUrl,
          mediaUrl: listing.image_url || null,
          scheduledFor: scheduledFor || null,
        }),
      });

      const data = await res.json();
      setStatusNotice(
        data.message ||
          `Caption copied & logged for ${activeMeta.label}!`
      );

      if (openExternal) {
        const target =
          activePlatform === "facebook"
            ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(captureUrl)}`
            : activeMeta.launchUrl;
        window.open(target, "_blank", "noopener,noreferrer");
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-[#24282B] border border-gray-700 rounded-2xl w-full max-w-4xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-green-400" />
              <h2 className="text-lg font-semibold text-white">
                Social & Video Autoposter Studio
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Promote <strong className="text-gray-200">{listing.address}</strong> across Facebook, Instagram, LinkedIn, YouTube Shorts & TikTok
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Platform Tabs */}
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const isSelected = activePlatform === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setActivePlatform(p.key);
                  setStatusNotice("");
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-[#111315] border-gray-800 text-gray-300 hover:border-gray-700"
                }`}
              >
                <span>{p.label}</span>
                <span className="text-[10px] opacity-75">({p.badge})</span>
              </button>
            );
          })}
        </div>

        {/* Main 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Editable Caption / Video Script */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">
                {activePlatform === "youtube" || activePlatform === "tiktok"
                  ? `${activeMeta.label} 30-Second Video Script & Caption`
                  : `${activeMeta.label} Ready-to-Publish Post`}
              </span>
              <button
                type="button"
                onClick={() => handleCopyText(currentCaption, "caption")}
                className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 cursor-pointer"
              >
                {copiedKey === "caption" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey === "caption" ? "Copied!" : "Copy Text"}</span>
              </button>
            </div>

            {generating ? (
              <div className="h-56 bg-[#111315] border border-gray-800 rounded-xl flex items-center justify-center text-xs text-gray-400">
                Generating {activeMeta.label} copy & hooks...
              </div>
            ) : (
              <textarea
                rows={10}
                value={currentCaption}
                onChange={(e) =>
                  setPosts((prev) => ({ ...prev, [activePlatform]: e.target.value }))
                }
                className="w-full bg-[#111315] border border-gray-700 rounded-xl p-4 text-xs text-gray-100 leading-relaxed outline-none focus:border-green-500"
              />
            )}

            {/* Schedule & Dispatch Controls */}
            <div className="bg-[#1A1D1F] border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-400" />
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="bg-[#111315] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-green-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={publishing || generating}
                  onClick={() => handleAutopost(false)}
                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Send size={13} />
                  <span>{scheduledFor ? "Schedule Autopost" : "Autopost Now"}</span>
                </button>

                <button
                  type="button"
                  disabled={publishing || generating}
                  onClick={() => handleAutopost(true)}
                  className="inline-flex items-center gap-1.5 bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-200 text-xs font-medium px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Copy & Open {activeMeta.label}</span>
                </button>
              </div>
            </div>

            {statusNotice && (
              <div className="bg-green-500/15 border border-green-500/30 text-green-400 text-xs px-3.5 py-2.5 rounded-lg">
                {statusNotice}
              </div>
            )}
          </div>

          {/* Right: Capture Link & Open-House QR Code */}
          <div className="lg:col-span-4 bg-[#111315] border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <QrCode size={15} className="text-green-400" />
              <span>Open-House & Flyer QR Code</span>
            </div>

            <div className="bg-white p-3 rounded-xl w-fit mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="Property Capture QR Code"
                className="w-40 h-40"
              />
            </div>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Scan to open the live capture funnel and route leads straight into your AI Concierge.
            </p>

            <div className="space-y-2">
              <a
                href={qrImageUrl}
                download={`closeflow-qr-${listing.id || "valuation"}.png`}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#1A1D1F] hover:bg-gray-800 border border-gray-700 text-gray-200 text-xs font-medium py-2 rounded-lg transition-colors"
              >
                <Download size={13} />
                <span>Download QR Code PNG</span>
              </a>

              <button
                type="button"
                onClick={() => handleCopyText(captureUrl, "url")}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-[#1A1D1F] hover:bg-gray-800 border border-gray-700 text-green-400 text-xs font-medium py-2 rounded-lg transition-colors cursor-pointer"
              >
                {copiedKey === "url" ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey === "url" ? "Capture URL Copied!" : "Copy Funnel Link"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}