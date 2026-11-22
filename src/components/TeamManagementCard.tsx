"use client";

import { useState } from "react";
import { UserPlus, Trash2, ShieldCheck, Clock, Copy, Check } from "lucide-react";

export interface TeamMember {
  id: string;
  email: string;
  role: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface TeamManagementProps {
  currentUserId: string;
  isUnlimited: boolean;
  initialMembers: TeamMember[];
  initialInvites: PendingInvite[];
}

export default function TeamManagementCard({
  currentUserId,
  isUnlimited,
  initialMembers,
  initialInvites,
}: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [invites, setInvites] = useState<PendingInvite[]>(initialInvites);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedLogin, setCopiedLogin] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send invite");
      }

      if (data.invite) {
        setInvites((prev) => [
          data.invite,
          ...prev.filter((i) => i.email !== data.invite.email),
        ]);
      }

      setFeedback({ type: "success", text: data.message });
      setEmail("");
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Invite failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    await fetch("/api/team/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    await fetch("/api/team/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/login`);
    setCopiedLogin(true);
    setTimeout(() => setCopiedLogin(false), 2000);
  };

  return (
    <div className="bg-[#24282B] rounded-xl p-6 border border-gray-800 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-white">Team & Workspace Access</h2>
            {isUnlimited && (
              <span className="inline-flex items-center gap-1 bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                <ShieldCheck size={12} />
                Unlimited Enterprise Seats
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Add brokers, associates, or VAs by email. Invited members share your live pipeline and inherit unlimited access.
          </p>
        </div>

        <button
          type="button"
          onClick={copyInviteLink}
          className="inline-flex items-center gap-1.5 bg-[#111315] hover:bg-gray-800 border border-gray-700 text-gray-200 text-xs font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          {copiedLogin ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          <span>{copiedLogin ? "Login Link Copied!" : "Copy Team Login Link"}</span>
        </button>
      </div>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@brokerage.com"
          className="flex-1 bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-white outline-none focus:border-green-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Member Role"
          className="bg-[#111315] border border-gray-700 rounded-lg px-3.5 py-2 text-sm text-gray-200 outline-none focus:border-green-500 cursor-pointer"
        >
          <option value="agent">Broker / Agent</option>
          <option value="admin">Admin</option>
          <option value="assistant">Transaction Coordinator / VA</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <UserPlus size={16} />
          <span>{loading ? "Adding..." : "Add Teammate"}</span>
        </button>
      </form>

      {feedback && (
        <div
          className={`text-xs px-3.5 py-2.5 rounded-lg border ${
            feedback.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Active Members List */}
      <div className="space-y-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Active Team Members ({members.length})
        </div>
        <div className="divide-y divide-gray-800 bg-[#1A1D1F] rounded-lg border border-gray-800">
          {members.map((member) => (
            <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-400 text-xs font-bold uppercase shrink-0">
                  {member.email.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-100 truncate">
                    {member.email}
                    {member.id === currentUserId && (
                      <span className="ml-2 text-[10px] text-gray-500">(You)</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                </div>
              </div>
              {member.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  title={`Remove ${member.email}`}
                  className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Pending Invites ({invites.length})
          </div>
          <div className="divide-y divide-gray-800 bg-[#1A1D1F] rounded-lg border border-gray-800">
            {invites.map((invite) => (
              <div key={invite.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock size={15} className="text-amber-400 shrink-0" />
                  <span className="text-sm text-gray-200 truncate">{invite.email}</span>
                  <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded capitalize">
                    {invite.role} • Pending Login
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeInvite(invite.id)}
                  title="Revoke invite"
                  className="text-gray-500 hover:text-red-400 p-1.5 rounded transition-colors cursor-pointer"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}