"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, DollarSign, Contact2, CheckSquare,
  Workflow, BarChart3, Settings, LogOut, Search, Bell, Sparkles, X
} from "lucide-react";
import { createClient } from "../lib/supabase/client";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Listings", href: "/listings", icon: Building2 },
  { label: "Deals", href: "/deals", icon: DollarSign },
  { label: "Contacts", href: "/contacts", icon: Contact2 },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Workflows", href: "/workflows", icon: Workflow },
  { label: "Reports", href: "/reports", icon: BarChart3 },
];

export default function AppShell({
  userEmail,
  searchPlaceholder = "Search leads by name or tag...",
  searchValue,
  searchQuery,
  notificationCount,
  onSearchChange,
  headerActions,
  children,
}: {
  userEmail: string;
  searchPlaceholder?: string;
  searchValue?: string;
  searchQuery?: string;
  notificationCount?: number;
  onSearchChange?: (val: string) => void;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [workspaceName, setWorkspaceName] = useState("CloseFlow");
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; detail: string; time: string; unread: boolean }>
  >([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [instantAlert, setInstantAlert] = useState<{
    id: string;
    name: string;
    source: string;
  } | null>(null);

  useEffect(() => {
    let activeChannel: any = null;

    async function initGlobalNotifications() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      const tenantId = profile?.tenant_id;
      if (!tenantId) return;

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .single();
      if (tenant?.name) setWorkspaceName(tenant.name);

      // Load recent leads as initial bell feed so bell is synced on every page
      const { data: recentLeads } = await supabase
        .from("leads")
        .select("id, full_name, source, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (recentLeads) {
        setNotifications(
          recentLeads.map((l, idx) => ({
            id: l.id,
            title: `New Lead: ${l.full_name || "Prospect"}`,
            detail: `Captured via ${l.source || "Direct"}`,
            time: new Date(l.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            unread: idx === 0,
          }))
        );
      }

      // Subscribe globally to instant form submissions / new leads on ANY page
      const channelName = `global-alerts-${tenantId}`;
      const existing = supabase
        .getChannels()
        .find((c) => c.topic === `realtime:${channelName}`);
      if (existing) supabase.removeChannel(existing);

      activeChannel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "leads",
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const lead = payload.new as any;
            const alertItem = {
              id: lead.id || String(Date.now()),
              title: `New Lead: ${lead.full_name || "Website Visitor"}`,
              detail: `Submitted ${lead.source || "Capture Form"}`,
              time: "Just now",
              unread: true,
            };

            setNotifications((prev) => [alertItem, ...prev.slice(0, 14)]);
            setInstantAlert({
              id: alertItem.id,
              name: lead.full_name || "New Prospect",
              source: lead.source || "Lead Capture Form",
            });
          }
        )
        .subscribe();
    }

    initGlobalNotifications();

    return () => {
      if (activeChannel) supabase.removeChannel(activeChannel);
    };
  }, [supabase]);

const unreadCount = Math.max(
  notifications.filter((n) => n.unread).length,
  notificationCount || 0
);
  const handleOpenBell = () => {
    setBellOpen((prev) => !prev);
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#111315] text-white flex">
      {/* Left Sidebar */}
      <aside className="w-60 shrink-0 bg-[#14171A] border-r border-gray-800 flex flex-col justify-between">
        <div>
          <div className="h-16 px-5 flex items-center gap-2.5 border-b border-gray-800">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center font-bold text-white text-xs">
              {workspaceName.charAt(0)}
            </div>
            <span className="font-semibold tracking-tight text-white truncate">
              {workspaceName}
            </span>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-green-600/20 text-green-400 border border-green-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-gray-800 space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === "/settings"
                ? "bg-green-600/20 text-green-400 border border-green-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Settings size={17} />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut size={17} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Top Header */}
        <header className="h-16 bg-[#14171A] border-b border-gray-800 px-6 flex items-center justify-between gap-4 relative z-30">
          <div className="relative w-full max-w-sm">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
  type="text"
  value={searchValue ?? searchQuery ?? ""}
  onChange={(e) => onSearchChange?.(e.target.value)}
  placeholder={searchPlaceholder}
  className="w-full bg-[#111315] border border-gray-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white outline-none focus:border-green-500"
/>
          </div>

          <div className="flex items-center gap-3">
            {headerActions}

            {/* Global Synced Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={handleOpenBell}
                className="relative p-2 rounded-xl bg-[#111315] border border-gray-800 text-gray-300 hover:text-white cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#24282B] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Live Lead & Form Alerts
                    </span>
                    <button
                      type="button"
                      onClick={() => setBellOpen(false)}
                      className="text-gray-400 hover:text-white cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-gray-400">No recent alerts.</p>
                    ) : (
                      notifications.map((n) => (
                        <Link
                          key={n.id}
                          href="/leads"
                          onClick={() => setBellOpen(false)}
                          className="block p-3.5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-white">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-gray-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{n.detail}</p>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pl-2 border-l border-gray-800">
              <div className="w-8 h-8 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center text-green-400 text-xs font-bold uppercase">
                {userEmail?.charAt(0) || "A"}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-medium text-white truncate max-w-[140px]">
                  {userEmail?.split("@")[0]}
                </div>
                <div className="text-[10px] text-gray-400">Admin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Instant New Lead / Form Submission Toast Banner (Shows on ANY Page) */}
        {instantAlert && (
          <div className="fixed bottom-5 right-5 z-50 bg-[#24282B] border border-green-500 rounded-2xl p-4 shadow-2xl max-w-sm flex items-start gap-3 animate-bounce">
            <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white">
                New Form Lead Captured!
              </div>
              <p className="text-xs text-gray-300 mt-0.5 truncate">
                <strong>{instantAlert.name}</strong> via {instantAlert.source}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href="/leads"
                  onClick={() => setInstantAlert(null)}
                  className="bg-green-600 text-white text-[11px] font-semibold px-3 py-1 rounded-lg"
                >
                  Open Lead & AI Concierge
                </Link>
                <button
                  type="button"
                  onClick={() => setInstantAlert(null)}
                  className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}