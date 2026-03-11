"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton({ className, iconSize = 20, showText = true }: { className?: string, iconSize?: number, showText?: boolean }) {
  const router = useRouter();

  const handleLogout = async () => {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={className || "flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 w-full text-left"}
    >
      <LogOut size={iconSize} />
      {showText && <span>Logout</span>}
    </button>
  );
}
