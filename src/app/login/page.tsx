"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      window.location.href = "/";
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");

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
    <div className="flex h-screen bg-[#111315] text-white items-center justify-center font-sans">
      <div className="bg-[#1A1D1F] p-8 rounded-xl border border-gray-800 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-bold text-xl">C</div>
          <span className="text-2xl font-semibold tracking-wide">CloseFlow</span>
        </div>
        
        <h1 className="text-xl font-medium mb-6 text-center">Sign in to your account</h1>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-green-500"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111315] border border-gray-700 rounded-lg px-4 py-2 text-white outline-none focus:border-green-500"
              required
            />
          </div>
          
          {message && <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded">{message}</div>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-lg mt-2 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#1A1D1F] px-2 text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[#111315] hover:bg-gray-900 text-white font-medium py-2.5 px-4 rounded-lg border border-gray-700 flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
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
              d="M5.53 14.39c-.23-.69-.36-1.43-.36-2.19s.13-1.5.36-2.19V6.79H1.37C.5 8.52 0 10.46 0 12.2s.5 3.68 1.37 5.41l4.16-3.22z"
            />
            <path
              fill="#4285F4"
              d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.39 0 3.36 2.44 1.37 6.39l4.16 3.22c.91-2.73 3.46-4.86 6.47-4.86z"
            />
          </svg>
          Google
        </button>
      </div>
    </div>
  );
}