"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ZippyLogo } from "@/components/ZippyLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"SA" | "ADMIN">("SA");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        // Use full navigation to bypass Next.js router cache,
        // which may have cached pre-login 307 redirects for these routes
        window.location.href = role === "ADMIN" ? "/admin" : "/projects";
      } else {
        alert("Login failed");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #1B2A4A 0%, #0d1829 60%, #111e38 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Speed-line background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(-55deg, transparent, transparent 40px, rgba(101,183,65,0.04) 40px, rgba(101,183,65,0.04) 41px),
            repeating-linear-gradient(-55deg, transparent, transparent 80px, rgba(0,188,212,0.03) 80px, rgba(0,188,212,0.03) 81px)
          `,
        }}
      />

      <div className="relative w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-white/95 p-10 shadow-2xl backdrop-blur-xl">
        {/* Logo */}
        <div className="flex justify-center">
          <ZippyLogo size="lg" showText={true} variant="dark" />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zippy-navy">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Demo Login — No password required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl border-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Full Name (Optional)
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl border-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Role</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("SA")}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 transition-all ${
                  role === "SA"
                    ? "border-zippy-green bg-zippy-green/7 text-zippy-green font-semibold"
                    : "border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span className="text-sm">Solution</span>
                <span className="text-sm">Architect</span>
              </button>
              <button
                type="button"
                onClick={() => setRole("ADMIN")}
                className={`flex flex-col items-center justify-center rounded-xl border p-4 transition-all ${
                  role === "ADMIN"
                    ? "border-zippy-cyan bg-zippy-cyan/7 text-zippy-cyan font-semibold"
                    : "border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span className="text-sm">Admin</span>
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl"
          >
            {isLoading ? "Signing In..." : "Continue →"}
          </Button>
        </form>
      </div>
    </div>
  );
}
