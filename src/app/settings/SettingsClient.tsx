"use client";

import { useState, useEffect } from "react";
import {
  Building2, Users, UserPlus, Sparkles, Check, Trash2, Shield,
  CreditCard, Copy, MailCheck, Landmark, MessageSquareText, Clock, AlertTriangle, ShieldCheck
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";
import { startSubscriptionCheckout } from "../../lib/billing";

const PLANS = [
  {
    id: "agent",
    name: "CloseFlow Agent",
    price: "$39",
    bundlePrice: "$31",
    period: "/mo",
    description: "Solo agents managing pipelines, Google Maps listings & AI lead capture.",
    features: ["14-day free trial included", "Up to 2 team seats", "AI Concierge Qualifier & Capture Pages"],
  },
  {
    id: "team",
    name: "CloseFlow Team",
    price: "$99",
    bundlePrice: "$79",
    period: "/mo",
    description: "Growing real estate teams with real-time pipeline sync and lender routing.",
    features: ["14-day free trial included", "Up to 10 team seats", "Real-Time Sync & Executive Reports"],
  },
  {
    id: "brokerage",
    name: "CloseFlow Brokerage",
    price: "$229",
    bundlePrice: "$183",
    period: "/mo",
    description: "Unlimited seats and multi-tenant isolation for full offices.",
    features: ["14-day free trial included", "Unlimited agent & admin seats", "Priority Onboarding & Support"],
  },
];

export default function SettingsClient({
  currentUserId,
  userEmail,
  currentUserRole,
  tenantId,
  initialWorkspaceName,
  initialClearCloseAI,
  initialPlanTier,
  initialSubscriptionStatus,
  initialTrialEndsAt,
  isUnlimited = false,
  initialOpeningScript,
  initialMembers,
  initialInvites,
  initialLenders,
}: {
  currentUserId: string;
  userEmail: string;
  currentUserRole: string;
  tenantId: string;
  initialWorkspaceName: string;
  initialClearCloseAI: boolean;
  initialPlanTier: string;
  initialSubscriptionStatus: string;
  initialTrialEndsAt: string | null;
  isUnlimited?: boolean;
  initialOpeningScript: string;
  initialMembers: any[];
  initialInvites: any[];
  initialLenders: any[];
}) {
  const supabase = createClient();
  const isAdmin = currentUserRole === "admin";

  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPaywallReason(params.get("paywall"));
  }, []);

  // Trial days calculation
  const daysRemaining = initialTrialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(initialTrialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  // Workspace Name & AI Script State
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [openingScript, setOpeningScript] = useState(initialOpeningScript);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [workspaceSavedMsg, setWorkspaceSavedMsg] = useState("");

  // Billing & Multi-App Bundle State
  const [planTier, setPlanTier] = useState(initialPlanTier);
  const [subStatus, setSubStatus] = useState(initialSubscriptionStatus);
  const [hasClearCloseAI, setHasClearCloseAI] = useState(initialClearCloseAI);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState("");

  // Partner Lenders State (Free to join)
  const [lenders, setLenders] = useState(initialLenders);
  const [newLender, setNewLender] = useState({
    full_name: "",
    company: "",
    email: "",
    phone: "",
  });
  const [isAddingLender, setIsAddingLender] = useState(false);

  // Team Members & Invites State
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || !isAdmin) return;
    setIsSavingWorkspace(true);
    setWorkspaceSavedMsg("");

    const { error } = await supabase
      .from("tenants")
      .update({
        name: workspaceName.trim(),
        ai_opening_script: openingScript.trim(),
      })
      .eq("id", tenantId);

    setIsSavingWorkspace(false);
    if (!error) {
      setWorkspaceSavedMsg("Workspace & AI Concierge opening script saved");
      setTimeout(() => setWorkspaceSavedMsg(""), 3000);
    }
  };

  const handleSelectPlan = async (
    targetPlan: "agent" | "team" | "brokerage" | "clearclose_ai"
  ) => {
    if (!isAdmin) return;
    setBillingLoading(targetPlan);
    setBillingNotice("");

    try {
      const data = await startSubscriptionCheckout({
        plan: targetPlan as any,
        tenantId,
      });

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.provider === "google_play" && data?.success) {
        setSubStatus("active");
        setPaywallReason(null);
        setBillingNotice("Google Play subscription verified and unlocked!");
        return;
      }

      if (targetPlan === "clearclose_ai") {
        const nextVal = !hasClearCloseAI;
        setHasClearCloseAI(nextVal);
        await supabase
          .from("tenants")
          .update({ has_clearclose_ai: nextVal })
          .eq("id", tenantId);
      } else {
        setPlanTier(targetPlan);
        setSubStatus("active");
        setPaywallReason(null);
        await supabase
          .from("tenants")
          .update({ plan_tier: targetPlan, subscription_status: "active" })
          .eq("id", tenantId);
      }

      setBillingNotice(
        data?.message ||
          "Updated in preview mode. Connect Stripe or Play Store keys to process live payments."
      );
    } finally {
      setBillingLoading(null);
    }
  };

  // Partner Lender Handlers
  const handleAddLender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLender.full_name.trim() || !newLender.phone.trim() || !isAdmin) return;
    setIsAddingLender(true);

    const { data, error } = await supabase
      .from("partner_lenders")
      .insert([
        {
          tenant_id: tenantId,
          full_name: newLender.full_name.trim(),
          company: newLender.company.trim() || "Partner Lending",
          email: newLender.email.trim(),
          phone: newLender.phone.trim(),
          is_active: true,
        },
      ])
      .select()
      .single();

    setIsAddingLender(false);
    if (!error && data) {
      setLenders((prev) => [...prev, data]);
      setNewLender({ full_name: "", company: "", email: "", phone: "" });
    }
  };

  const handleToggleLender = async (lenderId: string, currentActive: boolean) => {
    setLenders((prev) =>
      prev.map((l) => (l.id === lenderId ? { ...l, is_active: !currentActive } : l))
    );
    await supabase
      .from("partner_lenders")
      .update({ is_active: !currentActive })
      .eq("id", lenderId);
  };

  const handleDeleteLender = async (lenderId: string) => {
    setLenders((prev) => prev.filter((l) => l.id !== lenderId));
    await supabase.from("partner_lenders").delete().eq("id", lenderId);
  };

  // Team Invite Handlers
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !isAdmin) return;
    setIsInviting(true);
    setInviteError("");
    setInviteSuccess("");

    const cleanEmail = inviteEmail.trim().toLowerCase();

    const { data, error } = await supabase
      .from("tenant_invites")
      .insert([
        {
          tenant_id: tenantId,
          email: cleanEmail,
          role: inviteRole,
          invited_by: userEmail,
          status: "Pending",
        },
      ])
      .select()
      .single();

    if (error) {
      setIsInviting(false);
      setInviteError(error.message);
      return;
    }

    const emailRes = await fetch("/api/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        role: inviteRole,
        workspaceName,
        invitedBy: userEmail,
      }),
    });
    const emailData = await emailRes.json();

    setIsInviting(false);

    if (data) {
      setInvites((prev) => [data, ...prev]);
      setInviteEmail("");
      setInviteSuccess(
        emailData.sent
          ? `Invitation email sent to ${cleanEmail}!`
          : `Invite saved for ${cleanEmail}. Copy the invite link below to share.`
      );
    }
  };

  const handleCopyInviteLink = (id: string, email: string) => {
    const link = `${window.location.origin}/login?invite=${encodeURIComponent(email)}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    await supabase.from("tenant_invites").delete().eq("id", inviteId);
  };

  const handleRoleChange = async (memberId: string, nextRole: string) => {
    if (!isAdmin || memberId === currentUserId) return;
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: nextRole } : m))
    );
    await supabase.from("users").update({ role: nextRole }).eq("id", memberId);
  };

  return (
    <AppShell userEmail={userEmail} searchPlaceholder="Settings...">
      <div className="max-w-5xl space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-semibold">Workspace, AI & Billing Settings</h1>
          <p className="text-sm text-gray-400">
            Manage your CloseFlow subscription, ClearClose AI bundle discount, partner lenders, and AI Concierge scripts
          </p>
        </div>

        {/* Unlimited Founder & Team Access Banner */}
        {isUnlimited && (
          <div className="bg-green-500/15 border border-green-500/40 rounded-xl p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-green-300">
              <ShieldCheck size={18} className="text-green-400 shrink-0" />
              <span>
                <strong>Unlimited Enterprise Workspace Active:</strong> Your founder account and all invited teammates have unrestricted access with no trial limits.
              </span>
            </div>
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-semibold shrink-0">
              Unlimited Plan
            </span>
          </div>
        )}

        {/* Trial Expiration Paywall Banner (External Users Only) */}
        {!isUnlimited && paywallReason === "trial_expired" && subStatus !== "active" && (
          <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-4 flex items-center gap-3 text-sm text-red-200">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <div>
              <div className="font-semibold text-white">Your 14-Day Free Trial Has Ended</div>
              <p className="text-xs text-red-200/80">
                Select a CloseFlow subscription tier below to unlock your pipeline, listings, and AI Concierge.
              </p>
            </div>
          </div>
        )}

        {/* Active Trial Status Banner (External Users Only) */}
        {!isUnlimited && subStatus === "trialing" && paywallReason !== "trial_expired" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-green-300">
              <Clock size={16} className="text-green-400 shrink-0" />
              <span>
                <strong>14-Day Free Trial Active:</strong> {daysRemaining}{" "}
                {daysRemaining === 1 ? "day" : "days"} remaining before a paid CloseFlow plan is required.
              </span>
            </div>
            <span className="bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-medium shrink-0">
              Trialing
            </span>
          </div>
        )}

        {/* Commercial Subscription Plans + Multi-App Bundle Discount */}
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2.5">
              <CreditCard size={18} className="text-green-400" />
              <div>
                <h2 className="text-base font-medium">CloseFlow Subscription Plans</h2>
                <p className="text-xs text-gray-400">
                  Current Tier:{" "}
                  <span className="text-green-400 font-semibold uppercase">
                    {isUnlimited ? "UNLIMITED ENTERPRISE" : planTier}
                  </span>{" "}
                  • Status:{" "}
                  <span className="capitalize">{isUnlimited ? "Active" : subStatus}</span>
                </p>
              </div>
            </div>
            {hasClearCloseAI && (
              <span className="bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs px-3 py-1 rounded-full font-medium">
                ✓ 20% ClearClose AI Bundle Discount Active
              </span>
            )}
          </div>

          {billingNotice && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-lg mb-4">
              {billingNotice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = !isUnlimited && planTier === plan.id && subStatus === "active";
              const displayPrice = hasClearCloseAI ? plan.bundlePrice : plan.price;

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl p-5 border flex flex-col justify-between ${
                    isCurrent
                      ? "bg-[#1A1D1F] border-green-500"
                      : "bg-[#111315] border-gray-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">{plan.name}</span>
                      {isCurrent && (
                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-bold text-white">{displayPrice}</span>
                      <span className="text-xs text-gray-400">{plan.period}</span>
                      {hasClearCloseAI && (
                        <span className="text-xs text-gray-500 line-through">
                          {plan.price}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mb-4">{plan.description}</p>
                    <ul className="space-y-2 text-xs text-gray-300 mb-5">
                      {plan.features.map((feat) => (
                        <li key={feat} className="flex items-center gap-2">
                          <Check size={13} className="text-green-400 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={!isAdmin || isUnlimited || isCurrent || billingLoading === plan.id}
                    onClick={() => handleSelectPlan(plan.id as any)}
                    className={`w-full py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isUnlimited || isCurrent
                        ? "bg-gray-800 text-gray-400 cursor-default"
                        : "bg-green-600 hover:bg-green-500 text-white"
                    }`}
                  >
                    {isUnlimited
                      ? "Included in Unlimited Plan"
                      : billingLoading === plan.id
                      ? "Connecting..."
                      : isCurrent
                      ? "Current Plan"
                      : `Subscribe to ${plan.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ClearClose AI Separate App & 20% Bundle Discount Toggle */}
        <div className="bg-[#24282B] border border-purple-500/30 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-400" />
              <h2 className="text-base font-medium">
                ClearClose AI App — Save 20% When Bundled With CloseFlow
              </h2>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  hasClearCloseAI
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {hasClearCloseAI ? "20% Bundle Active" : "Separate App ($79/mo)"}
              </span>
            </div>
            <p className="text-xs text-gray-400 max-w-xl">
              Have both CloseFlow CRM and ClearClose AI Transaction Coordinator? Link your
              ClearClose AI subscription to unlock 20% off CloseFlow plus instant Offer-Ready handoffs.
            </p>
          </div>

          <button
            type="button"
            disabled={!isAdmin || billingLoading === "clearclose_ai"}
            onClick={() => handleSelectPlan("clearclose_ai")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
              hasClearCloseAI
                ? "bg-purple-600 hover:bg-purple-500 text-white"
                : "bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-200"
            }`}
          >
            {hasClearCloseAI ? "Bundle Linked (20% Off)" : "Link / Add ClearClose AI"}
          </button>
        </div>

        {/* Free Partner Lender Network */}
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Landmark size={18} className="text-green-400" />
              <div>
                <h2 className="text-base font-medium">Partner Lender Network</h2>
                <p className="text-xs text-gray-400">
                  Free for lending partners to join — unapproved buyers auto-route here during AI Concierge qualification
                </p>
              </div>
            </div>
            <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2.5 py-1 rounded-full">
              Free Partner Access
            </span>
          </div>

          {isAdmin && (
            <form
              onSubmit={handleAddLender}
              className="bg-[#1A1D1F] border border-gray-800 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-5 gap-3"
            >
              <input
                type="text"
                required
                placeholder="Lender Name *"
                value={newLender.full_name}
                onChange={(e) => setNewLender({ ...newLender, full_name: e.target.value })}
                className="bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
              />
              <input
                type="text"
                placeholder="Mortgage Company"
                value={newLender.company}
                onChange={(e) => setNewLender({ ...newLender, company: e.target.value })}
                className="bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
              />
              <input
                type="tel"
                required
                placeholder="Direct Phone *"
                value={newLender.phone}
                onChange={(e) => setNewLender({ ...newLender, phone: e.target.value })}
                className="bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
              />
              <input
                type="email"
                placeholder="Lender Email"
                value={newLender.email}
                onChange={(e) => setNewLender({ ...newLender, email: e.target.value })}
                className="bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={isAddingLender}
                className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {isAddingLender ? "Adding..." : "+ Add Lender"}
              </button>
            </form>
          )}

          {lenders.length === 0 ? (
            <p className="text-xs text-gray-500 italic">
              No partner lenders added yet. Add a loan officer above to enable automatic pre-qualification routing.
            </p>
          ) : (
            <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
              {lenders.map((lender) => (
                <div
                  key={lender.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-[#1A1D1F]/60 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {lender.full_name}{" "}
                      <span className="text-gray-400 font-normal">({lender.company})</span>
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {lender.phone} {lender.email ? `• ${lender.email}` : ""} •{" "}
                      <span className="text-green-400">{lender.referrals_count} referrals</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLender(lender.id, lender.is_active)}
                      className={`px-2.5 py-1 rounded-full font-medium cursor-pointer ${
                        lender.is_active
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {lender.is_active ? "Active Rotation" : "Paused"}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLender(lender.id)}
                        className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workspace Profile & Custom AI Concierge Opening Greeting */}
        <form
          onSubmit={handleSaveWorkspace}
          className="bg-[#24282B] border border-gray-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2.5">
            <Building2 size={18} className="text-green-400" />
            <h2 className="text-base font-medium">Workspace Profile & AI Opening Script</h2>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Brokerage / Team Name</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white outline-none focus:border-green-500 disabled:opacity-60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-gray-400 flex items-center gap-1.5">
                <MessageSquareText size={14} className="text-purple-400" />
                <span>Custom AI Concierge Opening Greeting</span>
              </label>
              <span className="text-[11px] text-gray-500">
                Placeholders: <code>{"{{first_name}}"}</code>, <code>{"{{source_label}}"}</code>
              </span>
            </div>
            <textarea
              rows={3}
              disabled={!isAdmin}
              value={openingScript}
              onChange={(e) => setOpeningScript(e.target.value)}
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-green-500 disabled:opacity-60 leading-relaxed"
            />
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSavingWorkspace}
                className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
              >
                {isSavingWorkspace ? "Saving..." : "Save Workspace Settings"}
              </button>
              {workspaceSavedMsg && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Check size={14} /> {workspaceSavedMsg}
                </span>
              )}
            </div>
          )}
        </form>

        {/* Invite Team Members */}
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-green-400" />
              <div>
                <h2 className="text-base font-medium">Team Members & Automated Invites</h2>
                <p className="text-xs text-gray-400">
                  Invited teammates receive an email link and join this workspace automatically with full access
                </p>
              </div>
            </div>
            <span className="text-xs bg-[#111315] border border-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
              {members.length} Active {members.length === 1 ? "Member" : "Members"}
            </span>
          </div>

          {isAdmin && (
            <form
              onSubmit={handleInviteMember}
              className="bg-[#1A1D1F] border border-gray-800 rounded-lg p-4 space-y-3"
            >
              <div className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <UserPlus size={14} className="text-green-400" />
                <span>Invite a Teammate</span>
              </div>

              {inviteError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 p-2 rounded flex items-center gap-1.5">
                  <MailCheck size={14} /> {inviteSuccess}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="agent@brokerage.com"
                  className="flex-1 bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-[#111315] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-green-500 cursor-pointer"
                >
                  <option value="agent">Agent</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {isInviting ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          )}

          {/* Active Members List */}
          <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3.5 bg-[#1A1D1F]/60 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/30 flex items-center justify-center text-green-400 font-semibold uppercase text-xs">
                      {member.email?.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{member.email}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">Active Workspace Member</div>
                    </div>
                  </div>

                  {isAdmin && !isSelf ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="bg-[#111315] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-green-500 cursor-pointer"
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#111315] border border-gray-700 text-gray-300 px-2.5 py-1 rounded capitalize">
                      <Shield size={12} className="text-green-400" />
                      {member.role}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Invitations
              </h3>
              <div className="divide-y divide-gray-800 border border-gray-800 rounded-lg overflow-hidden">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 bg-[#111315] text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-gray-200 font-medium">{inv.email}</span>
                      <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded capitalize">
                        {inv.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded ${
                          inv.status === "Accepted"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {inv.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => handleCopyInviteLink(inv.id, inv.email)}
                          className="inline-flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded cursor-pointer"
                        >
                          <Copy size={12} />
                          <span>{copiedId === inv.id ? "Copied!" : "Copy Link"}</span>
                        </button>
                      )}
                      {isAdmin && inv.status === "Pending" && (
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-gray-500 hover:text-red-400 p-1 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}