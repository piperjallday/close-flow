"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, Building, DollarSign, Contact, CheckSquare,
  Workflow, BarChart as BarChartIcon, Settings, Search, Bell,
  MoreHorizontal, Mail, Home, Star, LogOut, Plus, X, Trash2
} from "lucide-react";
import { BarChart, AreaChart } from "@tremor/react";
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
  themeMode = "dark",
  brandColor = "#22c55e",
  leads: initialLeads,
  listings: initialListings,
  workflows: initialWorkflows,
  partnerLenders: initialPartnerLenders = [],
}: DashboardProps) {
  const supabase = createClient();
  const [today, setToday] = useState("");
  const [leads, setLeads] = useState<any[]>(initialLeads);
  const [listings, setListings] = useState<any[]>(initialListings);
  const [workflows, setWorkflows] = useState<any[]>(initialWorkflows);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    initialListings[0]?.id || null
  );

  // Drag-and-Drop Kanban State
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Public Capture Links & LPMAMA AI Qualifier Drawer State
  const [copiedLinkKey, setCopiedLinkKey] = useState<string | null>(null);
  const [activeLpmamaLead, setActiveLpmamaLead] = useState<any | null>(null);
  const [lpmamaEvents, setLpmamaEvents] = useState<any[]>([]);
  const [prospectReplyInput, setProspectReplyInput] = useState("");
  const [isQualifying, setIsQualifying] = useState(false);

  // Real-time Team Sync across Leads, Listings, and Workflows
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`dashboard-live-${tenantId}`)
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
    status: "For Sale",
    tag: "New",
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
  window.location.href = "/";
};;

  const copyPublicLink = (key: string, path: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkKey(key);
    setTimeout(() => setCopiedLinkKey(null), 2000);
  };

  const openLpmamaDrawer = async (lead: any) => {
    setActiveLpmamaLead(lead);
    setProspectReplyInput("");
    const { data } = await supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true });
    setLpmamaEvents(data || []);
  };

  const handleSimulateProspectReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLpmamaLead || !prospectReplyInput.trim()) return;
    setIsQualifying(true);

    const res = await fetch("/api/ai/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: activeLpmamaLead.id,
        prospectReply: prospectReplyInput.trim(),
      }),
    });
    const data = await res.json();
    setIsQualifying(false);

    if (!res.ok) return;

    const updatedLead = {
    ...activeLpmamaLead,
    intent_score: data.intentScore,
    status: data.status,
    lpmama_data: data.lpmama,
    lender_routing_status: data.lenderRoutingStatus || activeLpmamaLead.lender_routing_status,
    assigned_lender_id: data.assignedLenderId || activeLpmamaLead.assigned_lender_id,
  };

    setActiveLpmamaLead(updatedLead);
    setLeads((prev) =>
      prev.map((item) => (item.id === updatedLead.id ? updatedLead : item))
    );
    setProspectReplyInput("");

    const { data: refreshedEvents } = await supabase
      .from("lead_events")
      .select("*")
      .eq("lead_id", updatedLead.id)
      .order("created_at", { ascending: true });
    setLpmamaEvents(refreshedEvents || []);
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

  // Move lead between Kanban stages
  const handleStageChange = async (leadId: string, newStatus: string) => {
    const previousLeads = [...leads];
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      console.error("Failed to update lead stage:", error.message);
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
          title: newWorkflow.title.trim(),
          icon_name: newWorkflow.icon_name,
          status: newWorkflow.status,
          triggers_count: 0,
          subtext: newWorkflow.subtext.trim() || "triggers",
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
          address: newListing.address.trim(),
          price: Number(newListing.price) || 0,
          beds: Number(newListing.beds) || 0,
          baths: Number(newListing.baths) || 0,
          status: newListing.status,
          tag: newListing.tag.trim() || "New",
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
        status: "For Sale",
        tag: "New",
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
      l.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black font-bold">
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
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell size={20} className="text-gray-400 hover:text-white cursor-pointer" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {leads.length}
              </span>
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
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

              <div className="grid grid-cols-3 gap-4 items-end mt-auto">
                <div className="col-span-1">
                  <BarChart
                    className="h-32"
                    data={barChartData}
                    index="name"
                    categories={["Active Leads"]}
                    colors={["green"]}
                    showYAxis={false}
                    showLegend={false}
                    showGridLines={false}
                  />
                </div>
                <div className="col-span-1">
                  <AreaChart
                    className="h-32"
                    data={areaChartData}
                    index="name"
                    categories={["Deals Closed"]}
                    colors={["green"]}
                    showYAxis={false}
                    showLegend={false}
                    showGridLines={false}
                  />
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyPublicLink("valuation", `/valuation/${tenantId}`)}
                    className="text-xs bg-[#111315] hover:bg-gray-800 border border-gray-700 text-green-400 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedLinkKey === "valuation"
                      ? "✓ Valuation Link Copied!"
                      : "Copy Home Valuation Link"}
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

              <div className="flex gap-4 overflow-x-auto pb-2 h-full">
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
                      onOpenLpmama={openLpmamaDrawer}
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

      {/* Interactive LPMAMA AI Qualification Drawer */}
      {activeLpmamaLead && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-end z-50">
          <div className="bg-[#1A1D1F] border-l border-gray-800 w-full max-w-lg h-full flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-gray-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {activeLpmamaLead.full_name}
                    </h3>
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                      Intent: {activeLpmamaLead.intent_score ?? 25}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Source: {activeLpmamaLead.lead_source || "Direct"} • Stage:{" "}
                    <span className="text-green-400">{activeLpmamaLead.status}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLpmamaLead(null)}
                  className="text-gray-400 hover:text-white text-sm px-2 py-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 6 LPMAMA Pillars Status Grid */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Lead Qualification Profile
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { label: "Location", val: activeLpmamaLead.lpmama_data?.location },
                    { label: "Price", val: activeLpmamaLead.lpmama_data?.price },
                    { label: "Mortgage", val: activeLpmamaLead.lpmama_data?.mortgage },
                    { label: "Agent Status", val: activeLpmamaLead.lpmama_data?.agent_status },
                    { label: "Motivation", val: activeLpmamaLead.lpmama_data?.motivation },
                    { label: "Appointment", val: activeLpmamaLead.lpmama_data?.appointment },
                  ].map((pillar) => (
                    <div
                      key={pillar.label}
                      className="bg-[#111315] border border-gray-800 rounded-lg p-2.5"
                    >
                      <div className="text-[10px] text-gray-500">{pillar.label}</div>
                      <div className="text-gray-200 font-medium truncate mt-0.5">
                        {pillar.val || "Pending..."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SMS / AI Conversation Thread */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Autonomous AI SMS Thread
                </div>
                <div className="bg-[#111315] border border-gray-800 rounded-xl p-4 space-y-3 max-h-72 overflow-y-auto">
                  {lpmamaEvents.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">
                      No AI messages yet. Simulate a prospect reply below to run autonomous AI qualification.
                    </p>
                  ) : (
                    lpmamaEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className={`flex flex-col ${
                          ev.message_sender === "prospect" ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="text-[10px] text-gray-500 mb-0.5">
                          {ev.message_sender === "prospect" ? "Prospect" : "CloseFlow AI"}
                        </span>
                        <div
                          className={`rounded-xl px-3.5 py-2 text-xs max-w-[85%] leading-relaxed ${
                            ev.message_sender === "prospect"
                              ? "bg-green-600 text-white"
                              : "bg-[#24282B] border border-gray-700 text-gray-200"
                          }`}
                        >
                          {ev.message_text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Test / Simulate Prospect Reply Input */}
            <form
              onSubmit={handleSimulateProspectReply}
              className="pt-4 border-t border-gray-800 flex gap-2"
            >
              <input
                type="text"
                value={prospectReplyInput}
                onChange={(e) => setProspectReplyInput(e.target.value)}
                placeholder="Simulate prospect SMS reply (e.g. 'Looking in Jacksonville around $550k')..."
                className="flex-1 bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={isQualifying}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {isQualifying ? "AI Replying..." : "Send Reply"}
              </button>
            </form>
          </div>
        </div>
      )}

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
                  <label className="block text-xs text-gray-400 mb-1">Icon</label>
                  <select
                    value={newWorkflow.icon_name}
                    onChange={(e) =>
                      setNewWorkflow({ ...newWorkflow, icon_name: e.target.value })
                    }
                    className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                  >
                    <option value="mail">Email (Mail)</option>
                    <option value="home">Property (Home)</option>
                    <option value="users">Nurture (Users)</option>
                    <option value="star">Review (Star)</option>
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
          <div className="bg-[#24282B] border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl">
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

              <div className="grid grid-cols-3 gap-3">
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
                  <label className="block text-xs text-gray-400 mb-1">Beds</label>
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
          ? "bg-green-500/10 text-green-500"
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
      <span className="text-green-500 text-xs font-medium">{trend}</span>
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
  onOpenLpmama,
}: {
  title: string;
  leads: any[];
  isDragOver?: boolean;
  onDragStartLead: (leadId: string) => void;
  onDragOverStage: () => void;
  onDragLeaveStage: () => void;
  onDropLead: () => void;
  onStageChange: (leadId: string, newStatus: string) => void;
  onOpenLpmama: (lead: any) => void;
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
      className={`flex-1 min-w-[185px] flex flex-col gap-3 rounded-lg p-2 transition-colors ${
        isDragOver
          ? "bg-green-500/10 border border-dashed border-green-500/60"
          : "border border-transparent"
      }`}
    >
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="text-gray-300 font-medium">{title}</span>
        <span className="bg-[#111315] text-green-500 text-[10px] px-2 py-0.5 rounded-full border border-gray-700">
          {leads.length}
        </span>
      </div>
      {leads.length === 0 ? (
        <div className="text-xs text-gray-600 italic border border-dashed border-gray-800 rounded p-3 text-center">
          Drop lead here
        </div>
      ) : (
        leads.map((lead) => {
          const score = Number(lead.intent_score ?? 25);
          const isHot = score >= 70;
          return (
            <div
              key={lead.id}
              draggable
              onDragStart={() => onDragStartLead(lead.id)}
              className="bg-[#2A2E32] p-3 rounded border border-gray-700 hover:border-green-500/60 transition-colors flex flex-col gap-2 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-start justify-between gap-1">
                <div>
                  <div className="text-xs font-medium text-gray-200 mb-0.5">
                    {lead.full_name}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    ${Number(lead.estimated_value || 0).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                    isHot
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-[#111315] text-gray-400 border border-gray-700"
                  }`}
                  title="Behavioral Intent Score"
                >
                  {isHot ? `🔥 ${score}%` : `${score}%`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1 border-t border-gray-700/60">
                <button
                  type="button"
                  onClick={() => onOpenLpmama(lead)}
                  className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer shrink-0"
                >
                  AI Qualifier
                </button>
                <select
                  value={lead.status}
                  onChange={(e) => onStageChange(lead.id, e.target.value)}
                  aria-label={`Move ${lead.full_name} to stage`}
                  className="bg-[#1A1D1F] text-gray-300 text-[10px] border border-gray-700 rounded px-1.5 py-0.5 outline-none focus:border-green-500 cursor-pointer max-w-[90px]"
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
            stroke="#22c55e"
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
              : "bg-green-500/20 hover:bg-green-500/30 text-green-500"
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
  onSelect: () => void;
  onStatusChange: (nextStatus: string) => void;
  onDelete: () => void;
}) {
  const badgeClasses =
    status === "Sold"
      ? "bg-red-500/20 text-red-400"
      : status === "Under Contract"
      ? "bg-yellow-500/20 text-yellow-400"
      : "bg-green-500/20 text-green-500";

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
      <div className="flex items-center justify-between gap-2 text-xs">
        <div>
          <span className="text-gray-300 font-medium">{price}</span>
          <span className="text-gray-500 ml-2">{specs}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink();
            }}
            className="text-[10px] bg-[#111315] hover:bg-gray-800 border border-gray-700 text-green-400 px-2 py-0.5 rounded transition-colors cursor-pointer"
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