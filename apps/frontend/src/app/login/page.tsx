"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match");
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Panel */}
      <div className="hidden md:flex flex-col justify-center w-[60%] bg-gradient-to-br from-[#1D3557] to-[#2A4A73] p-12 lg:p-24 text-paper">
        <h1 className="font-serif text-5xl font-semibold mb-4">ProcureMind AI</h1>
        <p className="text-lg mb-8 max-w-lg">
          Compare vendor proposals. Catch hidden costs. Decide with confidence.
        </p>
        <div className="mt-auto">
          <p className="font-serif text-paper/80 font-medium italic text-xl border-l-2 border-paper/30 pl-4">
            "Every price, checked against the fine print."
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-[40%] flex items-center justify-center bg-surface p-6 sm:p-12">
        <div className="w-full max-w-[380px] animate-in fade-in duration-500">
          
          <div className="flex items-center gap-6 mb-8 border-b border-rule">
            <button
              onClick={() => {
                setIsLogin(true);
                setError(null);
                setSuccess(false);
              }}
              className={cn(
                "pb-3 text-base font-medium transition-colors",
                isLogin ? "text-navy border-b-2 border-navy" : "text-ink-muted hover:text-ink"
              )}
            >
              Log in
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError(null);
                setSuccess(false);
              }}
              className={cn(
                "pb-3 text-base font-medium transition-colors",
                !isLogin ? "text-navy border-b-2 border-navy" : "text-ink-muted hover:text-ink"
              )}
            >
              Sign up
            </button>
          </div>

          {success ? (
            <div className="p-4 bg-verdigris/10 border border-verdigris/20 rounded-md">
              <p className="text-verdigris font-medium text-sm">
                Check your email to confirm your account.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1">
                <label className="block text-sm text-ink-muted">Email</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-rule bg-paper text-ink transition-colors focus:bg-surface focus:outline-none focus:ring-2 focus:ring-navy focus:border-navy"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm text-ink-muted">Password</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-rule bg-paper text-ink transition-colors focus:bg-surface focus:outline-none focus:ring-2 focus:ring-navy focus:border-navy"
                />
              </div>

              {!isLogin && (
                <div className="space-y-1">
                  <label className="block text-sm text-ink-muted">Confirm password</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-rule bg-paper text-ink transition-colors focus:bg-surface focus:outline-none focus:ring-2 focus:ring-navy focus:border-navy"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-audit-red">{error}</p>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-10 mt-2 bg-navy text-paper font-medium rounded-md hover:bg-navy/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy"
              >
                {loading ? (isLogin ? "Logging in..." : "Creating account...") : (isLogin ? "Log in" : "Create account")}
              </button>

              {isLogin && (
                <div className="pt-2">
                  <a href="#" className="text-sm text-ink-muted hover:text-navy transition-colors">
                    Forgot password?
                  </a>
                </div>
              )}
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
