"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"SA" | "ADMIN">("SA");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });

      if (res.ok) {
        if (role === "ADMIN") {
          router.push("/admin");
        } else {
          router.push("/projects");
        }
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 px-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-slate-200 bg-white/80 p-10 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sign In to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Zippy</span>
          </h1>
          <p className="mt-2 text-slate-600">Demo Login - No password required</p>
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
              className="bg-slate-50 border-slate-200"
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
              className="bg-slate-50 border-slate-200"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Role</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("SA")}
                className={`flex items-center justify-center rounded-xl border p-4 transition-all ${
                  role === "SA"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                Solution Architect
              </button>
              <button
                type="button"
                onClick={() => setRole("ADMIN")}
                className={`flex items-center justify-center rounded-xl border p-4 transition-all ${
                  role === "ADMIN"
                    ? "border-purple-500 bg-purple-500/10 text-purple-400"
                    : "border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-white text-slate-900 hover:bg-zinc-200"
          >
            {isLoading ? "Signing In..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
