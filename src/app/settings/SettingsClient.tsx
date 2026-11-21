"use client";

import { useState } from "react";
import {
  Building2, UserPlus, Mail, Shield, Trash2, Sparkles,
  Check, Copy, Clock, CheckCircle2
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { createClient } from "../../lib/supabase/client";

interface SettingsClientProps {
  currentUserId: string;
  userEmail: string;
  currentUserRole: string;
  tenantId: string;
  initialWorkspaceName: string;
  initialClearCloseAI: boolean;
  initialMembers: any[];
  initialInvites: any[];
}

export default function SettingsClient({
  currentUserId,
  userEmail,
  currentUserRole,
  tenantId,
  initialWorkspaceName,
  initialClearCloseAI,
  initialMembers,
  initialInvites,
}: SettingsClientProps) {
  const supabase = createClient();
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);

  const [hasClearCloseAI, setHasClearCloseAI] = useState(initialClearCloseAI);
  const [members, setMembers] = useState<any[]>(initialMembers);
  const [invites, setInvites] = useState<any[]>(initialInvites);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  // Save Workspace Name
  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || !tenantId) return;

    setIsSavingWorkspace(true);
    setWorkspaceSaved(false);

    const { error } = await supabase
      .from("tenants")
      .update({ name: workspaceName.trim() })
      .eq("id", tenantId);

    setIsSavingWorkspace(false);
    if (!error) {
      setWorkspaceSaved(true);
      setTimeout(() => setWorkspaceSaved(false), 3000);
    }
  };

  // Toggle ClearClose AI Subscription
  const handleToggleClearCloseAI = async () => {
    const nextValue = !hasClearCloseAI;
    setHasClearCloseAI(nextValue);
    await supabase
      .from("tenants")
      .update({ has_clearclose_ai: nextValue })
      .eq("id", tenantId);
  };

  // Send / Record Team Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    if (members.some((m) => m.email?.toLowerCase() === cleanEmail)) {
      setInviteError("This user is already a member of your workspace.");
      return;
    }

    setIsInviting(true);
    setInviteError("");

    const { data, error } = await supabase
      .from("tenant_invites")
      .insert([
        {
          email: cleanEmail,
          role: inviteRole,
          status: "Pending",
          invited_by_email: userEmail,
        },
      ])
      .select()
      .single();

    setIsInviting(false);

    if (error) {
      setInviteError(
        error.code === "23505"
          ? "An invite has already been sent to this email."
          : error.message
      );
      return;
    }

    if (data) {
      setInvites((prev) => [data, ...prev]);
      setInviteEmail("");
    }
  };

  // Copy signup link for invited teammate
  const handleCopyInviteLink = (inviteId: string) => {
    const loginUrl = `${window.location.origin}/login`;
    navigator.clipboard.writeText(loginUrl);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Revoke Pending Invite
  const handleRevokeInvite = async (inviteId: string) => {
    setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    await supabase.from("tenant_invites").delete().eq("id", inviteId);
  };

  // Update Teammate Role (admin <-> agent)
  const handleRoleChange = async (memberId: string, nextRole: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: nextRole } : m))
    );
    await supabase.from("users").update({ role: nextRole }).eq("id", memberId);
  };

  return (
    <AppShell userEmail={userEmail} searchPlaceholder="Workspace settings...">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Workspace & Team Settings</h1>
        <p className="text-sm text-gray-400">
          Manage your brokerage workspace, invite agents, and configure ClearClose AI
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Card 1: Workspace Profile */}
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <Building2 size={20} className="text-green-500" />
            <h2 className="text-lg font-medium">Workspace Profile</h2>
          </div>

          <form onSubmit={handleSaveWorkspace} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                Brokerage / Team Name
              </label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="w-full bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500 disabled:opacity-60"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500 font-mono">
                Tenant ID: {tenantId ? `${tenantId.slice(0, 8)}...` : "N/A"}
              </span>

              {isAdmin && (
                <button
                  type="submit"
                  disabled={isSavingWorkspace}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  {workspaceSaved ? (
                    <>
                      <Check size={14} />
                      <span>Saved</span>
                    </>
                  ) : (
                    <span>{isSavingWorkspace ? "Saving..." : "Save Changes"}</span>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Card 2: ClearClose AI Add-On Subscription */}
        <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles size={20} className="text-purple-400" />
                <h2 className="text-lg font-medium">ClearClose AI Integration</h2>
              </div>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  hasClearCloseAI
                    ? "bg-green-500/20 text-green-400"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {hasClearCloseAI ? "Active Subscription" : "Inactive"}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Enables one-click handoff of offer-ready leads from Tasks & Pipeline directly
              to the ClearClose AI Transaction Coordinator for automated offer drafting and
              closing timelines.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-800">
            <span className="text-xs text-gray-400">
              Applies to all agents in <strong>{workspaceName}</strong>
            </span>
            <button
              onClick={handleToggleClearCloseAI}
              disabled={!isAdmin}
              className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                hasClearCloseAI
                  ? "bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-300"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
              }`}
            >
              {hasClearCloseAI ? "Disable Add-On" : "Enable ClearClose AI"}
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Invite Teammates & Manage Members */}
      <div className="bg-[#24282B] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-2">
          <UserPlus size={20} className="text-green-500" />
          <h2 className="text-lg font-medium">Team Members & Invitations</h2>
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Invited teammates who sign up with their invited email automatically join{" "}
          <strong className="text-gray-200">{workspaceName}</strong> and share live leads,
          listings, and tasks.
        </p>

        {/* Invite Form */}
        {isAdmin && (
          <form onSubmit={handleSendInvite} className="mb-8">
            {inviteError && (
              <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-xs p-3 rounded-lg mb-3">
                {inviteError}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Mail
                  size={16}
                  className="text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                />
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@brokerage.com"
                  className="w-full bg-[#111315] border border-gray-700 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500"
                />
              </div>

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white outline-none focus:border-green-500 cursor-pointer"
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>

              <button
                type="submit"
                disabled={isInviting}
                className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                {isInviting ? "Inviting..." : "Send Invite"}
              </button>
            </div>
          </form>
        )}

        {/* Active Team Members Table */}
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Active Team Members ({members.length})
        </h3>
        <div className="border border-gray-800 rounded-lg overflow-hidden mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1A1D1F] border-b border-gray-800 text-xs text-gray-400">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-sm">
              {members.map((member) => {
                const isSelf = member.id === currentUserId;
                return (
                  <tr key={member.id} className="hover:bg-[#2A2E32]/50">
                    <td className="py-3.5 px-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-400 text-xs font-bold uppercase">
                        {member.email?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {member.email}{" "}
                          {isSelf && (
                            <span className="text-[11px] text-gray-500 ml-1">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isAdmin && !isSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="bg-[#111315] border border-gray-700 rounded px-2.5 py-1 text-xs text-gray-200 outline-none focus:border-green-500 cursor-pointer"
                        >
                          <option value="agent">Agent</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded capitalize">
                          <Shield size={12} className="text-green-400" />
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 size={14} /> Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pending Invitations */}
        {invites.length > 0 && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Invitations ({invites.length})
            </h3>
            <div className="border border-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1A1D1F] border-b border-gray-800 text-xs text-gray-400">
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800 text-sm">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#2A2E32]/50">
                      <td className="py-3.5 px-4 text-gray-200">{inv.email}</td>
                      <td className="py-3.5 px-4 capitalize text-xs text-gray-400">
                        {inv.role}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                            inv.status === "Accepted"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          <Clock size={12} /> {inv.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {inv.status === "Pending" && (
                          <button
                            onClick={() => handleCopyInviteLink(inv.id)}
                            className="inline-flex items-center gap-1 text-xs bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1 rounded cursor-pointer"
                            title="Copy invite signup link"
                          >
                            {copiedId === inv.id ? (
                              <>
                                <Check size={12} className="text-green-400" />
                                <span className="text-green-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="text-gray-500 hover:text-red-400 p-1 rounded cursor-pointer align-middle"
                            title="Revoke invite"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}