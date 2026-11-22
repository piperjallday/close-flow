import type { Metadata } from "next";
import "./globals.css";
import ThemeSyncProvider from "../components/ThemeSyncProvider";
export const metadata: Metadata = {
  title: "CloseFlow",
  description: "Multi-tenant Real Estate CRM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <ThemeSyncProvider />
{children}
      <body className="bg-[#111315] text-white antialiased">{children}</body>
    </html>
  );
}