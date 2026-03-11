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
    <div className="flex min-h-screen items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-zinc-900/50 p-10 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Sign In to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Zippy</span>
          </h1>
          <p className="mt-2 text-zinc-400">Demo Login - No password required</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-300">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-zinc-800/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-zinc-300">
              Full Name (Optional)
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-800/50 border-white/10"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Select Role</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("SA")}
                className={`flex items-center justify-center rounded-xl border p-4 transition-all ${
                  role === "SA"
                    ? "border-blue-500 bg-blue-500/10 text-blue-400"
                    : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10"
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
                    : "border-white/10 bg-white/5 text-zinc-500 hover:bg-white/10"
                }`}
              >
                Admin
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-white text-black hover:bg-zinc-200"
          >
            {isLoading ? "Signing In..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
