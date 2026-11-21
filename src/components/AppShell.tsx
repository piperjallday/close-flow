"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building, DollarSign, Contact, CheckSquare,
  Workflow, BarChart as BarChartIcon, Settings, Search, Bell, LogOut
} from "lucide-react";
import { createClient } from "../lib/supabase/client";

interface AppShellProps {
  userEmail: string;
  notificationCount?: number;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/listings", label: "Listings", icon: Building },
  { href: "/deals", label: "Deals", icon: DollarSign },
  { href: "/contacts", label: "Contacts", icon: Contact },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/reports", label: "Reports", icon: BarChartIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({
  userEmail,
  notificationCount = 0,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const supabase = createClient();
  const displayName = userEmail.split("@")[0];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-green-500/10 text-green-500"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                <Icon size={20} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
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
        <header className="h-20 border-b border-gray-800 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center bg-[#111315] rounded-md px-4 py-2 border border-gray-800 w-96">
            <Search size={18} className="text-gray-400 mr-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell size={20} className="text-gray-400 hover:text-white cursor-pointer" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {notificationCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600/20 border border-green-500/40 rounded-full flex items-center justify-center text-green-400 font-semibold uppercase">
                {displayName.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium capitalize">{displayName}</span>
                <span className="text-xs text-gray-400">Admin</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 overflow-y-auto flex-1">{children}</div>
      </main>
    </div>
  );
}