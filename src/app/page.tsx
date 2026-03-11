import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white selection:bg-blue-500/30">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl sm:p-16">
        {/* Abstract Background element */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-purple-600/10 blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center space-y-8 text-center sm:items-start sm:text-left">
          <div className="inline-flex items-center space-x-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            <span>System Online</span>
          </div>

          <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
            Welcome to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Zippy</span>
          </h1>

          <p className="max-w-2xl text-lg text-zinc-400 sm:text-xl">
            Your unified design builder, BOM generator, and high-level design engine for Solution Architects is now live on Google Cloud Run.
          </p>

          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Link 
              href="/projects"
              className="flex h-12 items-center justify-center rounded-xl bg-white px-8 font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95"
            >
              Launch Dashboard
            </Link>
            <Link 
              href="/admin"
              className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 active:scale-95"
            >
              Admin Portal
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { label: "Infrastructure", value: "Cloud Run", color: "text-blue-400" },
            { label: "Database", value: "Neon Serverless", color: "text-purple-400" },
            { label: "Environment", value: "Production", color: "text-green-400" },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-widest text-zinc-500">{item.label}</p>
              <p className={`text-lg font-medium ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-zinc-600">
        &copy; {new Date().getFullYear()} Zippy Networks. All rights reserved.
      </p>
    </div>
  );
}
