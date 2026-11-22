"use client";

import { useEffect } from "react";
import { createClient } from "../lib/supabase/client";

export function applyWorkspaceTheme(
  themeMode: string = "dark",
  brandColor: string = "#22c55e",
  workspaceName?: string
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", themeMode === "light" ? "light" : "dark");
  root.style.setProperty("--brand-color", brandColor || "#22c55e");

  localStorage.setItem(
    "closeflow_workspace_theme",
    JSON.stringify({
      themeMode: themeMode === "light" ? "light" : "dark",
      brandColor: brandColor || "#22c55e",
      workspaceName: workspaceName || "",
    })
  );
}

export default function ThemeSyncProvider() {
  useEffect(() => {
    // 1. Apply cached theme immediately to avoid flash
    try {
      const cached = localStorage.getItem("closeflow_workspace_theme");
      if (cached) {
        const parsed = JSON.parse(cached);
        applyWorkspaceTheme(parsed.themeMode, parsed.brandColor, parsed.workspaceName);
      }
    } catch {
      // ignore storage errors
    }

    // 2. Fetch authoritative workspace theme from Supabase
    const supabase = createClient();
    async function loadTenantTheme() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return;

      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, theme_mode, brand_color")
        .eq("id", profile.tenant_id)
        .single();

      if (tenant) {
        applyWorkspaceTheme(
          tenant.theme_mode || "dark",
          tenant.brand_color || "#22c55e",
          tenant.name
        );
      }
    }

    loadTenantTheme();

    // 3. Listen for instant updates from SettingsClient
    const handleThemeEvent = (e: Event) => {
      const custom = e as CustomEvent<{
        themeMode: string;
        brandColor: string;
        workspaceName?: string;
      }>;
      if (custom.detail) {
        applyWorkspaceTheme(
          custom.detail.themeMode,
          custom.detail.brandColor,
          custom.detail.workspaceName
        );
      }
    };

    window.addEventListener("closeflow:theme-updated", handleThemeEvent);
    return () => {
      window.removeEventListener("closeflow:theme-updated", handleThemeEvent);
    };
  }, []);

  return null;
}