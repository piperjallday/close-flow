"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "true" || params.get("plan") || params.get("bundle")) {
      setIsSignUp(true);
    }
    setSelectedPlan(params.get("plan"));
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsSuccessMessage(false);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      // Send instant founder notification on new trial signup
      await fetch("/api/alerts/new-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          workspaceName: `${email.split("@")[0]}'s Workspace`,
          selectedPlan: selectedPlan || "trialing",
        }),
      });

      if (data.session) {
        window.location.href = "/dashboard";
        return;
      }

      setIsSuccessMessage(true);
      setMessage("Check your inbox to confirm your email and activate your 14-day trial!");
      setLoading(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");
    setIsSuccessMessage(false);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#111315] text-white items-center justify-center font-sans px-4">
      <div className="bg-[#1A1D1F] p-8 rounded-xl border border-gray-800 w-full max-w-md shadow-2xl">
        <Link href="/" className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-bold text-xl">
            C
          </div>
          <span className="text-2xl font-semibold tracking-wide">CloseFlow</span>
        </Link>

        {/* Login / 14-Day Trial Toggle */}
        <div className="grid grid-cols-2 bg-[#111315] p-1 rounded-lg border border-gray-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setMessage("");
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              !isSignUp ? "bg-[#24282B] text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setMessage("");
            }}
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              isSignUp ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Sign Up for 14-Day Trial
          </button>
        </div>

        <h1 className="text-lg font-medium mb-1 text-center">
          {isSignUp ? "Start your 14-day free trial" : "Welcome back"}
        </h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          {isSignUp
            ? "Full workspace access for 14 days. No charge until your trial ends."
            : "Sign in to access your pipeline, listings, and AI concierge."}
        </p>

        {/* Google Auth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-3 text-sm transition-colors disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M24 12.27c0-.85-.08-1.68-.22-2.48H12v4.69h6.73c-.29 1.56-1.17 2.88-2.49 3.77v3.13h4.03c2.36-2.17 3.73-5.37 3.73-9.11z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-4.03-3.13c-1.11.75-2.54 1.19-3.9 1.19-3.01 0-5.56-2.03-6.47-4.76H1.37v3.22C3.36 21.56 7.39 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.53 14.39c-.23-.69-.36-1.43-.36-2.19s.13-1.5.36-2.19V6.79H1.37C.5 8.24 0 10.46 0 12.2s.5 3.68 1.37 5.41l4.16-3.22z"
            />
            <path
              fill="#4285F4"
              d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.39 0 3.36 2.44 1.37 6.39l4.16 3.22c.91-2.73 3.46-4.86 6.47-4.86z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#1A1D1F] px-2 text-gray-500">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Work Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@brokerage.com"
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-green-500"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-green-500"
              required
            />
          </div>

          {message && (
            <div
              className={`text-xs text-center py-2.5 px-3 rounded-lg border ${
                isSuccessMessage
                  ? "text-green-400 bg-green-500/10 border-green-500/30"
                  : "text-red-400 bg-red-500/10 border-red-500/30"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2.5 rounded-lg mt-1 text-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? isSignUp
                ? "Creating Trial Workspace..."
                : "Signing in..."
              : isSignUp
              ? "Sign Up for 14-Day Trial"
              : "Login"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}