import Link from "next/link";
import {
  Check,
  Sparkles,
  Users,
  MapPin,
  Kanban,
  Workflow,
  ShieldCheck,
  ArrowRight,
  Zap,
  Bot,
  Landmark,
} from "lucide-react";
import { createClient } from "../lib/supabase/server";

const PRICING_TIERS = [
  {
    id: "solo",
    name: "Solo Agent",
    price: "$99",
    bundlePrice: "$79",
    period: "/month",
    badge: "14-Day Free Trial",
    description:
      "Built for independent producing agents to capture leads, run LPMAMA AI qualification, and replace Listings to Leads & Homebot.",
    highlighted: false,
    cta: "Start 14-Day Free Trial",
    features: [
      "14-day free trial, then $99/mo",
      "Up to 2 team seats",
      "Public Property & Home Valuation Capture Pages",
      "Autonomous LPMAMA AI SMS Qualifier",
      "Interactive Google Maps Listing Inventory",
    ],
  },
  {
    id: "pro",
    name: "Pro Team",
    price: "$299",
    bundlePrice: "$239",
    period: "/month",
    badge: "Most Popular",
    description:
      "Real-time multi-user pipeline sync, automated lender warm-transfer routing, and executive brokerage analytics.",
    highlighted: true,
    cta: "Start 14-Day Free Trial",
    features: [
      "14-day free trial, then $299/mo",
      "Up to 10 team seats with role permissions",
      "Real-Time Multi-User Pipeline Sync",
      "Partner Lender Routing & Warm-Transfer Fallback",
      "70% Behavioral Intent Scoring & Priority Alerts",
    ],
  },
  {
    id: "brokerage",
    name: "White-Label Brokerage",
    price: "$599",
    bundlePrice: "$479",
    period: "/month",
    badge: "Unlimited Seats",
    description:
      "Full white-label workspace with custom Dark/Light mode, brand accent colors, and unlimited seats across your office.",
    highlighted: false,
    cta: "Start 14-Day Free Trial",
    features: [
      "14-day free trial, then $599/mo",
      "Unlimited agent & admin seats",
      "White-Label Custom Theme & Brand Accent Colors",
      "Isolated Multi-Tenant Workspace Security",
      "Priority Onboarding & Dedicated Support",
    ],
  },
];

const FEATURES = [
  {
    icon: <Bot size={20} className="text-purple-400" />,
    title: "Autonomous LPMAMA AI",
    description:
      "Engages prospects automatically across Location, Price, Mortgage, Agent status, Motivation, and Appointment—promoting hot leads at 70%+ intent.",
  },
  {
    icon: <Kanban size={20} className="text-green-400" />,
    title: "Real-Time Deal Kanban",
    description:
      "Drag leads from New Leads through Property Tours and Closed Deals while every teammate sees updates instantaneously.",
  },
  {
    icon: <MapPin size={20} className="text-green-400" />,
    title: "Capture Pages & Live Maps",
    description:
      "Share branded Property Showcase and Instant Home Valuation links without MLS overhead, backed by live Google Maps.",
  },
  {
    icon: <Landmark size={20} className="text-green-400" />,
    title: "Partner Lender Routing",
    description:
      "Automatically routes unapproved buyers to your free partner lender network with warm-transfer and voicemail callback fallbacks.",
  },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#111315] text-white font-sans selection:bg-green-500/30 selection:text-green-200">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#111315]/90 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-black font-bold text-lg">
              C
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-wide">CloseFlow</span>
              <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider bg-[#1A1D1F] border border-gray-800 text-gray-400 px-2 py-0.5 rounded">
                Guerrido Labs
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">
              Platform
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#clearclose-ai" className="hover:text-white transition-colors">
              ClearClose AI Bundle
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <span>Open Workspace</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white px-3 py-2 transition-colors"
                >
                  Sign In
                </Link>
                <a
                  href="#pricing"
                  className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
                >
                  Start Free Trial
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6 border-b border-gray-800/80">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#1A1D1F] border border-gray-800 text-green-400 text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
            <Zap size={14} />
            <span>14-Day Free Trial • Autonomous Real Estate CRM & LPMAMA AI</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-tight mb-6">
            Capture, Qualify & Close Leads{" "}
            <span className="text-green-500">On Autopilot</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            CloseFlow combines public Property & Home Valuation capture pages, autonomous
            LPMAMA AI qualification, partner lender routing, and real-time team Kanban sync
            in one white-label workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors"
            >
              <span>Start Your 14-Day Free Trial</span>
              <ArrowRight size={18} />
            </a>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1A1D1F] hover:bg-[#24282B] border border-gray-700 text-gray-200 font-medium px-7 py-3.5 rounded-xl transition-colors"
            >
              <span>{user ? "Go to Dashboard" : "Member Sign In"}</span>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-green-500" />
              Isolated Multi-Tenant Security
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={15} className="text-green-500" />
              Web & Android Play Store Ready
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-purple-400" />
              20% Off When Bundled With ClearClose AI
            </span>
          </div>
        </div>
      </section>

      {/* Platform Features Grid */}
      <section id="features" className="py-20 px-6 bg-[#1A1D1F] border-b border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold mb-3">
              Replace Third-Party Lead & Valuation Tools
            </h2>
            <p className="text-sm text-gray-400">
              Capture buyers and sellers directly from social links and QR codes, score intent
              automatically, and hand off contract-ready deals to ClearClose AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="bg-[#24282B] border border-gray-800 rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-[#111315] border border-gray-800 flex items-center justify-center mb-4">
                    {feat.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{feat.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commercial Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-[#111315]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
              14-Day Free Trial • Paid Commercial SaaS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">
              Plans Built to Scale With Your Deal Volume
            </h2>
            <p className="text-sm text-gray-400">
              Start with full access for 14 days. Choose the workspace tier that fits your
              team—or save 20% automatically when paired with ClearClose AI.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.id}
                className={`rounded-2xl p-8 flex flex-col justify-between border transition-all ${
                  tier.highlighted
                    ? "bg-[#24282B] border-green-500 shadow-2xl shadow-green-950/20 relative"
                    : "bg-[#1A1D1F] border-gray-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        tier.highlighted
                          ? "bg-green-500/20 text-green-400 border border-green-500/40"
                          : "bg-[#111315] text-gray-400 border border-gray-800"
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold text-white">{tier.price}</span>
                    <span className="text-sm text-gray-400">{tier.period}</span>
                  </div>
                  <div className="text-xs text-purple-300 font-medium mb-4">
                    Or {tier.bundlePrice}/mo with ClearClose AI (20% Bundle Savings)
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed mb-6">
                    {tier.description}
                  </p>

                  <div className="h-px bg-gray-800 mb-6" />

                  <ul className="space-y-3.5 text-sm text-gray-300 mb-8">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check size={16} className="text-green-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={
                    user
                      ? `/settings?selected_plan=${tier.id}`
                      : `/login?signup=true&plan=${tier.id}`
                  }
                  className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors block ${
                    tier.highlighted
                      ? "bg-green-600 hover:bg-green-500 text-white"
                      : "bg-[#111315] hover:bg-gray-800 border border-gray-700 text-white"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* ClearClose AI Cross-App Bundle Banner */}
          <div
            id="clearclose-ai"
            className="mt-12 bg-[#24282B] border border-purple-500/30 rounded-2xl p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
          >
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-medium px-3 py-1 rounded-full">
                <Sparkles size={14} />
                <span>Separate App • Save 20% When Bundled With CloseFlow</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                Already Using ClearClose AI ($79/mo)? Get 20% Off Both Apps
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                CloseFlow CRM and ClearClose AI are priced separately so you only pay for
                what you use—or link both apps in Workspace Settings to automatically unlock{" "}
                <span className="text-green-400 font-semibold">
                  20% off your CloseFlow subscription
                </span>{" "}
                plus one-click Offer-Ready transaction handoffs.
              </p>
            </div>

            <Link
              href={
                user
                  ? "/settings?bundle=clearclose_ai"
                  : "/login?signup=true&bundle=clearclose_ai"
              }
              className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors"
            >
              Claim 20% Bundle Discount
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#111315] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2.5 text-gray-300 font-medium">
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-black font-bold text-xs">
              C
            </div>
            <span>CloseFlow • A Guerrido Labs Platform</span>
          </div>
          <div>© {new Date().getFullYear()} Guerrido Labs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}