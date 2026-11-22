"use client";

import Link from "next/link";
import AiConciergeDrawer, { LeadRecord } from "../components/AiConciergeDrawer";
import SocialAutoposterModal from "../components/SocialAutoposterModal";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, Building, DollarSign, Contact, CheckSquare,
  Workflow, BarChart as BarChartIcon, Settings, Search, Bell,
  MoreHorizontal, Mail, Home, Star, LogOut, Plus, X, Trash2, Share2, Sparkles
} from "lucide-react";
import { AreaChart } from "@tremor/react";
import { createClient } from "../lib/supabase/client";
import ListingsMap from "../components/ListingsMap";

const barChartData = [
  { name: "Jan", "Active Leads": 100 }, { name: "Feb", "Active Leads": 150 },
  { name: "Mar", "Active Leads": 200 }, { name: "Apr", "Active Leads": 300 },
  { name: "May", "Active Leads": 250 }, { name: "Jun", "Active Leads": 280 },
];

const areaChartData = [
  { name: "Jan", "Deals Closed": 50 }, { name: "Feb", "Deals Closed": 80 },
  { name: "Mar", "Deals Closed": 60 }, { name: "Apr", "Deals Closed": 90 },
  { name: "May", "Deals Closed": 120 }, { name: "Jun", "Deals Closed": 150 },
];

const sparkDataActive = [
  { month: "Jan", Performance: 4000 }, { month: "Feb", Performance: 3000 },
  { month: "Mar", Performance: 2000 }, { month: "Apr", Performance: 2780 },
  { month: "May", Performance: 1890 }, { month: "Jun", Performance: 2390 },
];

const sparkDataPaused = [
  { month: "Jan", Performance: 1000 }, { month: "Feb", Performance: 1000 },
  { month: "Mar", Performance: 1000 }, { month: "Apr", Performance: 1000 },
];

const PIPELINE_STAGES = [
  "New Leads",
  "Contacted",
  "Property Tours",
  "Fav Offers",
  "Closed Deals",
];

const LISTING_STATUSES = ["For Sale", "Under Contract", "Sold"];

interface DashboardProps {
  userEmail: string;
  userRole?: string;
  tenantId: string;
  themeMode?: string;
  brandColor?: string;
  leads: any[];
  listings: any[];
  workflows: any[];
  partnerLenders?: any[];
}

export default function DashboardClient({
  userEmail,
  userRole = "agent",
  tenantId,
  leads: initialLeads,
  listings: initialListings,
  workflows: initialWorkflows,
}: DashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [today, setToday] = useState("");
  const [leads, setLeads] = useState<any[]>(initialLeads);
  const [listings, setListings] = useState<any[]>(initialListings);
  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows);
  const [searchQuery, setSearchQuery] = useState("");

  // Interactive Persistent Alert Bell & Instant Form Lead Toast State
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [lastSeenAlertTime, setLastSeenAlertTime] = useState<string>("");
  const [instantLeadToast, setInstantLeadToast] = useState<any | null>(null);

  // AI Concierge Drawer State
  const [activeConciergeLead, setActiveConciergeLead] = useState<LeadRecord | null>(null);
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);

  // ClearClose AI Offer Handoff Modal State
  const [clearCloseOfferLead, setClearCloseOfferLead] = useState<any | null>(null);

  // Social Autoposter Studio State
  const [socialListing, setSocialListing] = useState<any | null>(null);

  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    initialListings[0]?.id || null
  );

  // Drag-and-Drop Kanban State
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);

  // Load persisted alert clear timestamp
  useEffect(() => {
    if (!tenantId) return;
    const saved = localStorage.getItem(`closeflow_alerts_cleared_${tenantId}`);
    if (saved) setLastSeenAlertTime(saved);
  }, [tenantId]);

  const handleClearAlerts = () => {
    const nowIso = new Date().toISOString();
    setLastSeenAlertTime(nowIso);
    if (tenantId) {
      localStorage.setItem(`closeflow_alerts_cleared_${tenantId}`, nowIso);
    }
  };

  // Real-time Team Sync across Leads, Listings, and Workflows
  useEffect(() => {
    if (!tenantId) return;

    const channelName = `dashboard-live-${tenantId}`;

    // Clean up any stale channel instance before registering .on() listeners
    const existingChannel = supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${channelName}`);
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLeads((prev) =>
              prev.some((l) => l.id === payload.new.id)
                ? prev
                : [payload.new, ...prev]
            );
            setInstantLeadToast(payload.new);
            setTimeout(() => setInstantLeadToast(null), 8000);
          } else if (payload.eventType === "UPDATE") {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === payload.new.id ? { ...l, ...payload.new } : l
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setListings((prev) =>
              prev.some((item) => item.id === payload.new.id)
                ? prev
                : [payload.new, ...prev]
            );
          } else if (payload.eventType === "UPDATE") {
            setListings((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? { ...item, ...payload.new } : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setListings((prev) => {
              const updated = prev.filter((item) => item.id !== payload.old.id);
              setSelectedListingId((curr) =>
                curr === payload.old.id ? updated[0]?.id || null : curr
              );
              return updated;
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workflows",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setWorkflows((prev) =>
              prev.some((wf) => wf.id === payload.new.id)
                ? prev
                : [...prev, payload.new]
            );
          } else if (payload.eventType === "UPDATE") {
            setWorkflows((prev) =>
              prev.map((wf) =>
                wf.id === payload.new.id ? { ...wf, ...payload.new } : wf
              )
            );
          } else if (payload.eventType === "DELETE") {
            setWorkflows((prev) => prev.filter((wf) => wf.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, supabase]);

  // Add Lead Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [newLead, setNewLead] = useState({
    full_name: "",
    email: "",
    phone: "",
    estimated_value: "",
    status: "New Leads",
    tag: "New",
  });

  // Add Workflow Modal State
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [newWorkflow, setNewWorkflow] = useState({
    title: "",
    icon_name: "mail",
    status: "Active",
    trigger_stage: "New Leads",
    subtext: "triggered today",
  });

  // Add Listing Modal State
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [listingError, setListingError] = useState("");
  const [newListing, setNewListing] = useState({
    address: "",
    price: "",
    beds: "3",
    baths: "2",
    sqft: "",
    status: "For Sale",
    tag: "New",
    image_url: "",
    description: "",
  });

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const copyPublicLink = (key: string, path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkKey(key);
    setTimeout(() => setCopiedLinkKey(null), 2000);
  };

  const openConciergeForLead = (lead: any) => {
    setActiveConciergeLead({
      id: lead.id,
      name: lead.full_name || lead.name || "Prospect",
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.lead_source || lead.source,
      notes: lead.notes,
      qualification_score: lead.qualification_score ?? lead.intent_score ?? 0,
      qualification_data: lead.qualification_data || lead.lpmama_data || {},
      conversation_history: lead.conversation_history || [],
    });
    setIsConciergeOpen(true);
  };

  // Create new lead in Supabase
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.full_name.trim()) return;

    setIsSaving(true);
    setFormError("");

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          tenant_id: tenantId,
          full_name: newLead.full_name.trim(),
          email: newLead.email.trim() || null,
          phone: newLead.phone.trim() || null,
          estimated_value: Number(newLead.estimated_value) || 0,
          status: newLead.status,
          tag: newLead.tag.trim() || "New",
        },
      ])
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (data) {
      setLeads((prev) => [data, ...prev]);
      setNewLead({
        full_name: "",
        email: "",
        phone: "",
        estimated_value: "",
        status: "New Leads",
        tag: "New",
      });
      setIsAddModalOpen(false);
    }
  };

  // Move lead between Kanban stages + trigger ClearClose AI Offer modal on "Fav Offers" + fire drip workflows
  const handleStageChange = async (leadId: string, newStatus: string) => {
    const previousLeads = [...leads];
    const targetLead = leads.find((l) => l.id === leadId);

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    if (newStatus === "Fav Offers" && targetLead) {
      setClearCloseOfferLead({ ...targetLead, status: newStatus });
    }

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      console.error("Failed to update lead stage:", error.message);
      setLeads(previousLeads);
      return;
    }

    fetch("/api/workflows/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        leadId,
        stage: newStatus,
      }),
    }).catch((err) => console.error("Workflow trigger error:", err));
  };

  // Delete lead from Kanban & Supabase
  const handleDeleteLead = async (leadId: string) => {
    const previousLeads = [...leads];
    setLeads((prev) => prev.filter((l) => l.id !== leadId));

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId);

    if (error) {
      console.error("Failed to delete lead:", error.message);
      setLeads(previousLeads);
    }
  };

  // Toggle Workflow Active / Paused status
  const handleToggleWorkflow = async (workflowId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Active" ? "Paused" : "Active";
    const previousWorkflows = [...workflows];

    setWorkflows((prev) =>
      prev.map((wf) => (wf.id === workflowId ? { ...wf, status: nextStatus } : wf))
    );

    const { error } = await supabase
      .from("workflows")
      .update({ status: nextStatus })
      .eq("id", workflowId);

    if (error) {
      console.error("Failed to toggle workflow:", error.message);
      setWorkflows(previousWorkflows);
    }
  };

  // Create new Workflow
  const handleAddWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflow.title.trim()) return;

    setIsSavingWorkflow(true);
    setWorkflowError("");

    const { data, error } = await supabase
      .from("workflows")
      .insert([
        {
          tenant_id: tenantId,
          title: newWorkflow.title.trim(),
          icon_name: newWorkflow.icon_name,
          status: newWorkflow.status,
          trigger_stage: newWorkflow.trigger_stage,
          triggers_count: 0,
          subtext: newWorkflow.subtext.trim() || `On "${newWorkflow.trigger_stage}"`,
        },
      ])
      .select()
      .single();

    setIsSavingWorkflow(false);

    if (error) {
      setWorkflowError(error.message);
      return;
    }

    if (data) {
      setWorkflows((prev) => [...prev, data]);
      setNewWorkflow({
        title: "",
        icon_name: "mail",
        status: "Active",
        trigger_stage: "New Leads",
        subtext: "triggered today",
      });
      setIsWorkflowModalOpen(false);
    }
  };

  // Create new Listing
  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListing.address.trim()) return;

    setIsSavingListing(true);
    setListingError("");

    const { data, error } = await supabase
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
          image_url: newListing.image_url.trim() || null,
          description: newListing.description.trim() || null,
        },
      ])
      .select()
      .single();

    setIsSavingListing(false);

    if (error) {
      setListingError(error.message);
      return;
    }

    if (data) {
      setListings((prev) => [data, ...prev]);
      setSelectedListingId(data.id);
      setNewListing({
        address: "",
        price: "",
        beds: "3",
        baths: "2",
        sqft: "",
        status: "For Sale",
        tag: "New",
        image_url: "",
        description: "",
      });
      setIsListingModalOpen(false);
    }
  };

  // Update Listing Status
  const handleListingStatusChange = async (listingId: string, nextStatus: string) => {
    const previousListings = [...listings];
    const nextTag =
      nextStatus === "Sold"
        ? "Sold"
        : nextStatus === "Under Contract"
        ? "Under Contract"
        : "Active";

    setListings((prev) =>
      prev.map((item) =>
        item.id === listingId ? { ...item, status: nextStatus, tag: nextTag } : item
      )
    );

    const { error } = await supabase
      .from("listings")
      .update({ status: nextStatus, tag: nextTag })
      .eq("id", listingId);

    if (error) {
      console.error("Failed to update listing status:", error.message);
      setListings(previousListings);
    }
  };

  // Delete Listing from Supabase
  const handleDeleteListing = async (listingId: string) => {
    const previousListings = [...listings];
    const updatedListings = listings.filter((item) => item.id !== listingId);
    setListings(updatedListings);

    if (selectedListingId === listingId) {
      setSelectedListingId(updatedListings[0]?.id || null);
    }

    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", listingId);

    if (error) {
      console.error("Failed to delete listing:", error.message);
      setListings(previousListings);
    }
  };

  // Filter leads by search input
  const filteredLeads = leads.filter(
    (l) =>
      (l.full_name || l.name)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Unread Alerts filtered by persisted clear timestamp (synced to 20 items to match AppShell)
  const unreadAlerts = [...leads]
    .filter((l) => {
      if (!lastSeenAlertTime) return true;
      const itemTime = new Date(l.last_contacted_at || l.created_at || 0).getTime();
      return itemTime > new Date(lastSeenAlertTime).getTime();
    })
    .sort(
      (a, b) =>
        new Date(b.last_contacted_at || b.created_at || 0).getTime() -
        new Date(a.last_contacted_at || a.created_at || 0).getTime()
    )
    .slice(0, 20);

  // Live Metric Calculations
  const activeLeadsCount = leads.filter((l) => l.status !== "Closed Deals").length;
  const newListingsCount = listings.filter((item) => item.status !== "Sold").length;
  const closedDeals = leads.filter((l) => l.status === "Closed Deals");
  const dealsClosedCount = closedDeals.length;
  const totalRevenue = closedDeals.reduce(
    (sum, deal) => sum + Number(deal.estimated_value || 0),
    0
  );

  const formattedRevenue =
    totalRevenue >= 1_000_000
      ? `$${(totalRevenue / 1_000_000).toFixed(2)}M`
      : `$${totalRevenue.toLocaleString()}`;

  const displayName = userEmail.split("@")[0];
  const selectedListing =
    listings.find((item) => item.id === selectedListingId) || listings[0];

  const getWorkflowIcon = (iconName: string) => {
    switch (iconName) {
      case "home":
        return <Home size={16} />;
      case "users":
        return <Users size={16} />;
      case "star":
        return <Star size={16} />;
      default:
        return <Mail size={16} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#111315] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111315] border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
            C
          </div>
          <span className="text-xl font-semibold tracking-wide">CloseFlow</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          <NavItem href="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <NavItem href="/leads" icon={<Users size={20} />} label="Leads" />
          <NavItem href="/listings" icon={<Building size={20} />} label="Listings" />
          <NavItem href="/deals" icon={<DollarSign size={20} />} label="Deals" />
          <NavItem href="/contacts" icon={<Contact size={20} />} label="Contacts" />
          <NavItem href="/tasks" icon={<CheckSquare size={20} />} label="Tasks" />
          <NavItem href="/workflows" icon={<Workflow size={20} />} label="Workflows" />
          <NavItem href="/reports" icon={<BarChartIcon size={20} />} label="Reports" />
          <NavItem href="/settings" icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors text-sm cursor-pointer"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#1A1D1F] overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-gray-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center bg-[#111315] rounded-md px-4 py-2 border border-gray-800 w-96">
            <Search size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name or tag..."
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
            />
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => {
                setActiveConciergeLead(null);
                setIsConciergeOpen(true);
              }}
              className="bg-green-600/15 hover:bg-green-600/25 text-green-400 border border-green-500/30 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
              AI Concierge
            </button>

            {/* Interactive Persistent Alert Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAlertsOpen((prev) => !prev)}
                className="relative p-1.5 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Workspace Alerts"
              >
                <Bell size={20} className="text-gray-300 hover:text-white" />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {unreadAlerts.length}
                  </span>
                )}
              </button>

              {isAlertsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#14171A] border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-[#1A1D1F]">
                    <span className="text-xs font-semibold text-white">
                      Live Lead & Concierge Alerts
                    </span>
                    {unreadAlerts.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAlerts}
                        className="text-[11px] text-green-400 hover:underline cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/80">
                    {unreadAlerts.length === 0 ? (
                      <div className="p-6 text-xs text-gray-500 text-center">
                        All caught up! No new alerts.
                      </div>
                    ) : (
                      unreadAlerts.map((item) => {
                        const score = Number(
                          item.qualification_score ?? item.intent_score ?? 0
                        );
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setIsAlertsOpen(false);
                              openConciergeForLead(item);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-[#1F2327] transition-colors flex flex-col gap-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-gray-100 truncate">
                                {item.full_name || item.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  score >= 75
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-800 text-gray-400"
                                }`}
                              >
                                {score >= 75
                                  ? `Qualified (${score}%)`
                                  : item.status || "New"}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">
                              {item.notes ||
                                `Source: ${item.lead_source || item.source || "Direct"}`}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 border border-green-500/40 rounded-full flex items-center justify-center text-green-400 font-semibold uppercase">
                {displayName.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium capitalize">{displayName}</span>
                <span className="text-xs text-gray-400 capitalize">{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 overflow-y-auto flex-1">
          <h1 className="text-2xl font-semibold mb-1 capitalize">
            Dashboard: Welcome back, {displayName}!
          </h1>
          <div className="flex items-center gap-3 mb-8">
            <p className="text-gray-400 text-sm">
              {today ? `${today} | ` : ""}👋 Live Workspace Overview
            </p>
            <span className="bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] px-2.5 py-0.5 rounded-full">
              Live Team Sync
            </span>
          </div>

          {/* Top Row: Metrics & Kanban */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6 items-start">
            {/* Key Metrics Overview Card */}
            <div className="bg-[#24282B] rounded-xl p-6 border border-gray-800 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-200">Key Metrics Overview</h2>
                <MoreHorizontal size={20} className="text-gray-500 cursor-pointer hover:text-white" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Metric label="Active Leads" value={activeLeadsCount.toString()} trend="Live DB" />
                <Metric label="Active Listings" value={newListingsCount.toString()} trend="Live DB" />
                <Metric label="Deals Closed" value={dealsClosedCount.toString()} trend="Live DB" />
                <Metric label="Total Revenue" value={formattedRevenue} trend="Live DB" />
              </div>

              <div className="grid grid-cols-3 gap-4 items-end pt-2">
                {/* Bar Chart */}
                <div className="col-span-1 flex flex-col justify-end h-32">
                  <div className="flex items-end justify-between gap-1.5 h-24 px-1">
                    {barChartData.map((d) => {
                      const heightPct = Math.round((d["Active Leads"] / 300) * 100);
                      return (
                        <div key={d.name} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-green-600 rounded-t transition-all"
                            title={`${d.name}: ${d["Active Leads"]} leads`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-1">
                    {barChartData.map((d) => (
                      <span key={d.name}>{d.name}</span>
                    ))}
                  </div>
                </div>

                {/* Trend Area Chart */}
                <div className="col-span-1 flex flex-col justify-end h-32">
                  <svg viewBox="0 0 180 80" className="w-full h-24 overflow-visible">
                    <defs>
                      <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-color)" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="var(--brand-color)" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <polygon
                      fill="url(#emeraldArea)"
                      points="0,80 0,53 36,37 72,48 108,32 144,16 180,4 180,80"
                    />
                    <polyline
                      fill="none"
                      stroke="var(--brand-color)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points="0,53 36,37 72,48 108,32 144,16 180,4"
                    />
                  </svg>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 px-1">
                    {areaChartData.map((d) => (
                      <span key={d.name}>{d.name}</span>
                    ))}
                  </div>
                </div>

                <div className="col-span-1 flex justify-around items-center h-32">
                  <MetricRing value={75} label="Pipeline" />
                  <MetricRing value={45} label="Quota" />
                </div>
              </div>
            </div>

            {/* Lead Pipeline (Kanban) */}
            <div className="bg-[#24282B] rounded-xl p-6 border border-gray-800 flex flex-col">
              <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
                <h2 className="text-lg font-medium text-gray-200">Lead Pipeline (Kanban)</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyPublicLink("valuation", `/valuation/${tenantId}`)}
                    className="text-xs bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedLinkKey === "valuation"
                      ? "✓ Valuation Link Copied!"
                      : "Copy Property Valuation Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSocialListing({
                        address: "Free Home & Property Valuation Report",
                        tag: "Seller Valuation Funnel",
                        description:
                          "Curious what your home or investment property is worth in today's market? Get a custom market report and comparable sales breakdown.",
                      })
                    }
                    className="inline-flex items-center gap-1 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Share2 size={12} />
                    <span>Autopost Valuation</span>
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Lead</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-4 overflow-x-auto overflow-y-auto max-h-[420px] pb-2 pr-1">
                {PIPELINE_STAGES.map((stage) => {
                  const stageLeads = filteredLeads.filter((l) => l.status === stage);
                  return (
                    <KanbanColumn
                      key={stage}
                      title={stage}
                      leads={stageLeads}
                      isDragOver={dragOverStage === stage}
                      onDragStartLead={(leadId) => setDraggedLeadId(leadId)}
                      onDragOverStage={() => setDragOverStage(stage)}
                      onDragLeaveStage={() =>
                        setDragOverStage((curr) => (curr === stage ? null : curr))
                      }
                      onDropLead={() => {
                        if (draggedLeadId) {
                          handleStageChange(draggedLeadId, stage);
                        }
                        setDraggedLeadId(null);
                        setDragOverStage(null);
                      }}
                      onStageChange={handleStageChange}
                      onDeleteLead={handleDeleteLead}
                      onOpenConcierge={openConciergeForLead}
                      onOpenClearCloseOffer={(lead) => setClearCloseOfferLead(lead)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Row: Workflows & Listings */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Automated Workflows */}
            <div className="bg-[#24282B] rounded-xl p-6 border border-gray-800">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-medium text-gray-200">Automated Workflows</h2>
                  <p className="text-[11px] text-gray-500">
                    Click status badge to toggle Active / Paused
                  </p>
                </div>
                <button
                  onClick={() => setIsWorkflowModalOpen(true)}
                  className="flex items-center gap-1.5 bg-[#1A1D1F] hover:bg-gray-800 border border-gray-700 text-gray-200 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Workflow</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows.map((wf) => (
                  <WorkflowCard
                    key={wf.id}
                    title={wf.title}
                    icon={getWorkflowIcon(wf.icon_name)}
                    status={wf.status}
                    triggers={wf.triggers_count.toString()}
                    subtext={wf.subtext}
                    data={wf.status === "Paused" ? sparkDataPaused : sparkDataActive}
                    color={wf.status === "Paused" ? "slate" : "green"}
                    onToggle={() => handleToggleWorkflow(wf.id, wf.status)}
                  />
                ))}
              </div>
            </div>

            {/* Recent Listings */}
            <div className="bg-[#24282B] rounded-xl p-6 border border-gray-800 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-200">
                  Recent Listings (Map & List)
                </h2>
                <button
                  onClick={() => setIsListingModalOpen(true)}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Listing</span>
                </button>
              </div>
              <div className="flex gap-4 flex-1">
                <div className="w-1/2 h-80 bg-[#1A1D1F] rounded-lg border border-gray-700 overflow-hidden relative">
                  <ListingsMap
                    listings={listings}
                    selectedListingId={selectedListing?.id || null}
                    onSelectListing={(id) => setSelectedListingId(id)}
                  />
                </div>
                <div className="w-1/2 flex flex-col gap-3 justify-start max-h-80 overflow-y-auto pr-1">
                  {listings.map((item, idx) => (
                    <div key={item.id}>
                      <ListingItem
                        address={item.address}
                        price={`$${Number(item.price).toLocaleString()}`}
                        specs={`${item.beds}bd/${item.baths}ba`}
                        status={item.status}
                        tag={item.tag}
                        isSelected={selectedListing?.id === item.id}
                        isLinkCopied={copiedLinkKey === `listing_${item.id}`}
                        onCopyLink={() =>
                          copyPublicLink(`listing_${item.id}`, `/p/${item.id}`)
                        }
                        onAutopost={() => setSocialListing(item)}
                        onSelect={() => setSelectedListingId(item.id)}
                        onStatusChange={(nextStatus) =>
                          handleListingStatusChange(item.id, nextStatus)
                        }
                        onDelete={() => handleDeleteListing(item.id)}
                      />
                      {idx < listings.length - 1 && (
                        <div className="h-px bg-gray-800 my-2"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Instant Form Lead Alert Banner */}
      {instantLeadToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#24282B] border border-green-500 rounded-2xl p-4 shadow-2xl max-w-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white">New Form Lead Captured!</div>
            <p className="text-xs text-gray-300 mt-0.5 truncate">
              <strong>{instantLeadToast.full_name || "Prospect"}</strong> •{" "}
              {instantLeadToast.source || "Lead Capture Form"}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  openConciergeForLead(instantLeadToast);
                  setInstantLeadToast(null);
                }}
                className="bg-green-600 text-white text-[11px] font-semibold px-3 py-1 rounded-lg cursor-pointer"
              >
                Open AI Concierge
              </button>
              <button
                type="button"
                onClick={() => setInstantLeadToast(null)}
                className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ClearClose AI Offer Handoff Modal */}
      {clearCloseOfferLead && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-600/20 border border-green-500/40 text-green-400">
                ClearClose AI • Contract & Offer Engine
              </span>
              <button
                type="button"
                onClick={() => setClearCloseOfferLead(null)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">
                Ready to Write an Offer for{" "}
                {clearCloseOfferLead.full_name || clearCloseOfferLead.name}?
              </h3>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Send this qualified lead directly into <strong>ClearClose AI</strong> to
                auto-draft state-specific purchase contracts, contingencies, and e-signature
                packets in seconds.
              </p>
            </div>

            <div className="bg-[#111315] border border-gray-800 rounded-xl p-3.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-400">Buyer / Client:</span>
                <span className="font-semibold text-white">
                  {clearCloseOfferLead.full_name || clearCloseOfferLead.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Target Offer Value:</span>
                <span className="font-semibold text-white">
                  ${Number(clearCloseOfferLead.estimated_value || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">AI Qualification Score:</span>
                <span className="font-semibold text-white">
                  {clearCloseOfferLead.qualification_score ??
                    clearCloseOfferLead.intent_score ??
                    25}
                  %
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <a
                href={`https://clearclose.ai/write-offer?lead_name=${encodeURIComponent(
                  clearCloseOfferLead.full_name || clearCloseOfferLead.name || ""
                )}&email=${encodeURIComponent(
                  clearCloseOfferLead.email || ""
                )}&price=${encodeURIComponent(
                  String(clearCloseOfferLead.estimated_value || 0)
                )}&source=closeflow`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl text-center transition-colors"
              >
                Launch Write Offer Tool in ClearClose AI →
              </a>
              <button
                type="button"
                onClick={() => setClearCloseOfferLead(null)}
                className="w-full text-xs text-gray-400 hover:text-white py-1.5 cursor-pointer"
              >
                Keep in CloseFlow Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live AI Concierge Drawer & Simulator */}
      <AiConciergeDrawer
        lead={activeConciergeLead}
        isOpen={isConciergeOpen}
        onClose={() => setIsConciergeOpen(false)}
        onLeadUpdated={(updated) => {
          setLeads((prev) =>
            prev.map((item) =>
              item.id === updated.id
                ? {
                    ...item,
                    qualification_score: updated.qualification_score,
                    intent_score: updated.qualification_score,
                    qualification_data: updated.qualification_data,
                    conversation_history: updated.conversation_history,
                    notes: updated.notes,
                  }
                : item
            )
          );
          setActiveConciergeLead((prev) =>
            prev && prev.id === updated.id ? { ...prev, ...updated } : prev
          );
        }}
      />

      {/* Social & Video Autoposter Studio Modal */}
      <SocialAutoposterModal
        isOpen={Boolean(socialListing)}
        onClose={() => setSocialListing(null)}
        tenantId={tenantId}
        listing={socialListing}
      />

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Add New Lead</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newLead.full_name}
                  onChange={(e) => setNewLead({ ...newLead, full_name: e.target.value })}
                  placeholder="e.g. Jordan Taylor"
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="jordan@email.com"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="555-0199"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estimated Value ($)</label>
                  <input
                    type="number"
                    value={newLead.estimated_value}
                    onChange={(e) =>
                      setNewLead({ ...newLead, estimated_value: e.target.value })
                    }
                    placeholder="550000"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tag</label>
                  <input
                    type="text"
                    value={newLead.tag}
                    onChange={(e) => setNewLead({ ...newLead, tag: e.target.value })}
                    placeholder="Hot, Buyer, Pre-Approved"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Pipeline Stage</label>
                <select
                  value={newLead.status}
                  onChange={(e) => setNewLead({ ...newLead, status: e.target.value })}
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Workflow Modal */}
      {isWorkflowModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Create Automated Workflow</h3>
              <button
                onClick={() => setIsWorkflowModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {workflowError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">
                {workflowError}
              </div>
            )}

            <form onSubmit={handleAddWorkflow} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Workflow Name *</label>
                <input
                  type="text"
                  required
                  value={newWorkflow.title}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, title: e.target.value })}
                  placeholder="e.g. Open House Follow-up"
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Trigger Stage</label>
                  <select
                    value={newWorkflow.trigger_stage}
                    onChange={(e) =>
                      setNewWorkflow({ ...newWorkflow, trigger_stage: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    {PIPELINE_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Initial Status</label>
                  <select
                    value={newWorkflow.status}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, status: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Icon</label>
                  <select
                    value={newWorkflow.icon_name}
                    onChange={(e) =>
                      setNewWorkflow({ ...newWorkflow, icon_name: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="mail">Email / SMS (Mail)</option>
                    <option value="home">Property (Home)</option>
                    <option value="users">Nurture (Users)</option>
                    <option value="star">Review (Star)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Trigger Subtext</label>
                  <input
                    type="text"
                    value={newWorkflow.subtext}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, subtext: e.target.value })}
                    placeholder="triggered today"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWorkflowModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingWorkflow}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {isSavingWorkflow ? "Saving..." : "Create Workflow"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Listing Modal */}
      {isListingModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold text-white">Add Property Listing</h3>
              <button
                onClick={() => setIsListingModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {listingError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-4">
                {listingError}
              </div>
            )}

            <form onSubmit={handleAddListing} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Property Address *</label>
                <input
                  type="text"
                  required
                  value={newListing.address}
                  onChange={(e) => setNewListing({ ...newListing, address: e.target.value })}
                  placeholder="e.g. 500 Brickell Ave, Miami, FL"
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Price ($) *</label>
                  <input
                    type="number"
                    required
                    value={newListing.price}
                    onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                    placeholder="925000"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Square Feet (SqFt)</label>
                  <input
                    type="number"
                    value={newListing.sqft}
                    onChange={(e) => setNewListing({ ...newListing, sqft: e.target.value })}
                    placeholder="2450"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Beds / Units</label>
                  <input
                    type="number"
                    value={newListing.beds}
                    onChange={(e) => setNewListing({ ...newListing, beds: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Baths</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newListing.baths}
                    onChange={(e) => setNewListing({ ...newListing, baths: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Hero Photo URL (Optional)</label>
                <input
                  type="url"
                  value={newListing.image_url}
                  onChange={(e) => setNewListing({ ...newListing, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Property Highlights / Description</label>
                <textarea
                  rows={2}
                  value={newListing.description}
                  onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                  placeholder="Turnkey property with updated finishes, prime location, and strong value..."
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Listing Status</label>
                  <select
                    value={newListing.status}
                    onChange={(e) => setNewListing({ ...newListing, status: e.target.value })}
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    {LISTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={newListing.tag}
                    onChange={(e) => setNewListing({ ...newListing, tag: e.target.value })}
                    placeholder="New, Featured, Open House"
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsListingModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingListing}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {isSavingListing ? "Saving..." : "Save Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Components
function NavItem({
  href = "#",
  icon,
  label,
  active = false,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
        active
          ? "bg-green-500/15 text-green-400 border border-green-500/30"
          : "text-gray-400 hover:text-white hover:bg-gray-800/50"
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function Metric({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-sm mb-1">{label}</span>
      <span className="text-2xl font-semibold mb-1">{value}</span>
      <span className="text-green-400 text-xs font-medium">{trend}</span>
    </div>
  );
}

function KanbanColumn({
  title,
  leads,
  isDragOver = false,
  onDragStartLead,
  onDragOverStage,
  onDragLeaveStage,
  onDropLead,
  onStageChange,
  onDeleteLead,
  onOpenConcierge,
  onOpenClearCloseOffer,
}: {
  title: string;
  leads: any[];
  isDragOver?: boolean;
  onDragStartLead: (leadId: string) => void;
  onDragOverStage: () => void;
  onDragLeaveStage: () => void;
  onDropLead: () => void;
  onStageChange: (leadId: string, newStatus: string) => void;
  onDeleteLead: (leadId: string) => void;
  onOpenConcierge: (lead: any) => void;
  onOpenClearCloseOffer: (lead: any) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverStage();
      }}
      onDragLeave={onDragLeaveStage}
      onDrop={(e) => {
        e.preventDefault();
        onDropLead();
      }}
      className={`flex-1 min-w-[225px] flex flex-col gap-3 rounded-lg p-2.5 transition-colors ${
        isDragOver
          ? "bg-green-500/10 border border-dashed border-green-500/60"
          : "border border-transparent"
      }`}
    >
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="text-gray-300 font-medium">{title}</span>
        <span className="bg-[#111315] text-gray-200 text-[10px] px-2 py-0.5 rounded-full border border-gray-700">
          {leads.length}
        </span>
      </div>
      {leads.length === 0 ? (
        <div className="text-xs text-gray-600 italic border border-dashed border-gray-800 rounded p-3 text-center">
          Drop lead here
        </div>
      ) : (
        leads.map((lead) => {
          const score = Number(lead.qualification_score ?? lead.intent_score ?? 25);
          const isHot = score >= 75;
          return (
            <div
              key={lead.id}
              draggable
              onDragStart={() => onDragStartLead(lead.id)}
              className="bg-[#2A2E32] p-3.5 rounded-lg border border-gray-700 hover:border-green-500/60 transition-colors flex flex-col gap-2.5 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-gray-100 truncate mb-0.5">
                    {lead.full_name || lead.name}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    ${Number(lead.estimated_value || 0).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      isHot
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-[#111315] text-gray-300 border border-gray-700"
                    }`}
                    title="AI Concierge Readiness Score"
                  >
                    {isHot ? `🔥 ${score}%` : `${score}%`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteLead(lead.id);
                    }}
                    title={`Delete ${lead.full_name || lead.name}`}
                    className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-700/60">
                <button
                  type="button"
                  onClick={() => onOpenConcierge(lead)}
                  className="w-full bg-green-600/20 hover:bg-green-600/30 text-gray-100 border border-green-500/30 text-[11px] py-1 px-2.5 rounded transition-colors cursor-pointer font-medium text-center"
                >
                  AI Concierge
                </button>
                <button
                  type="button"
                  onClick={() => onOpenClearCloseOffer(lead)}
                  className="w-full bg-[#111315] hover:bg-gray-800 text-gray-100 border border-gray-700 text-[11px] py-1 px-2.5 rounded transition-colors cursor-pointer font-medium text-center"
                >
                  Write Offer • ClearClose AI →
                </button>
                <select
                  value={lead.status}
                  onChange={(e) => onStageChange(lead.id, e.target.value)}
                  aria-label={`Move ${lead.full_name || lead.name} to stage`}
                  className="w-full bg-[#1A1D1F] text-gray-200 text-[11px] border border-gray-700 rounded px-2 py-1 outline-none focus:border-green-500 cursor-pointer"
                >
                  {PIPELINE_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function MetricRing({ value, label }: { value: number; label: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="#1A1D1F"
            strokeWidth="6"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="var(--brand-color)"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-xs font-semibold text-white">
          {value}%
        </span>
      </div>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}

function WorkflowCard({
  title,
  icon,
  status,
  triggers,
  subtext,
  data,
  color = "green",
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  status: string;
  triggers: string;
  subtext: string;
  data: any[];
  color?: string;
  onToggle: () => void;
}) {
  const isPaused = status === "Paused";
  return (
    <div className="bg-[#1A1D1F] p-4 rounded-lg border border-gray-800 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
          <span className="text-gray-500">{icon}</span> {title}
        </div>
        <button
          onClick={onToggle}
          title="Click to toggle Active / Paused"
          className={`text-[10px] px-2.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
            isPaused
              ? "bg-gray-800 hover:bg-gray-700 text-gray-400"
              : "bg-green-500/20 hover:bg-green-500/30 text-gray-100 border border-green-500/30"
          }`}
        >
          {status}
        </button>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-semibold">{triggers}</div>
          <div className="text-xs text-gray-500">{subtext}</div>
        </div>
        <div className="w-20">
          <AreaChart
            className="h-10 mt-2"
            data={data}
            index="month"
            categories={["Performance"]}
            colors={[color as any]}
            showYAxis={false}
            showXAxis={false}
            showLegend={false}
            showGridLines={false}
            customTooltip={() => null}
          />
        </div>
      </div>
    </div>
  );
}

function ListingItem({
  address,
  price,
  specs,
  status,
  tag,
  isSelected = false,
  isLinkCopied = false,
  onCopyLink,
  onAutopost,
  onSelect,
  onStatusChange,
  onDelete,
}: {
  address: string;
  price: string;
  specs: string;
  status: string;
  tag: string;
  isSelected?: boolean;
  isLinkCopied?: boolean;
  onCopyLink: () => void;
  onAutopost: () => void;
  onSelect: () => void;
  onStatusChange: (nextStatus: string) => void;
  onDelete: () => void;
}) {
  const badgeClasses =
    status === "Sold"
      ? "bg-red-500/20 text-red-400"
      : status === "Under Contract"
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-green-500/20 text-gray-100 border border-green-500/30";

  return (
    <div
      onClick={onSelect}
      className={`flex flex-col gap-1.5 text-sm p-2 rounded-lg transition-colors cursor-pointer ${
        isSelected ? "bg-[#1A1D1F] border border-gray-700" : "hover:bg-[#1A1D1F]/60"
      }`}
    >
      <div className="flex justify-between items-center gap-2 text-gray-200">
        <span className="font-medium truncate">{address}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`${badgeClasses} text-[10px] px-1.5 py-0.5 rounded`}>
            {tag}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={`Delete ${address}`}
            className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-gray-300 font-medium">{price}</span>
          <span className="text-gray-500 ml-2">{specs}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAutopost();
            }}
            className="inline-flex items-center gap-1 text-[10px] bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            <Share2 size={10} />
            <span>Autopost</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink();
            }}
            className="text-[10px] bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-100 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            {isLinkCopied ? "✓ Copied" : "Capture Link"}
          </button>
          <select
            value={status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label={`Change status for ${address}`}
            className="bg-[#111315] text-gray-300 text-[10px] border border-gray-700 rounded px-1.5 py-0.5 outline-none focus:border-green-500 cursor-pointer"
          >
            {LISTING_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}