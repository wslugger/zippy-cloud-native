interface ZippyLogoProps {
  /** sm = 28px slug, md = 42px slug (default), lg = 56px slug */
  size?: "sm" | "md" | "lg";
  /** Show "ZIPPY" + "Managed Services" text alongside the slug */
  showText?: boolean;
  /** light = white text for dark backgrounds; dark = navy text for light backgrounds (default) */
  variant?: "light" | "dark";
}

const sizes = {
  sm: { w: 28, h: 21, scale: 0.67 },
  md: { w: 42, h: 32, scale: 1 },
  lg: { w: 56, h: 43, scale: 1.33 },
};

export function ZippyLogo({ size = "md", showText = true, variant = "dark" }: ZippyLogoProps) {
  const { w, h } = sizes[size];
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-4xl" : "text-2xl";
  const subTextSize = size === "sm" ? "text-[8px]" : size === "lg" ? "text-[12px]" : "text-[10px]";
  const subTextColor = variant === "light" ? "text-white/50" : "text-slate-400";

  return (
    <div className="flex items-center gap-2.5">
      {/* Slug mark */}
      <svg width={w} height={h} viewBox="0 0 42 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="24" cy="20" rx="14" ry="10" fill="#65B741" />
        <ellipse cx="24" cy="20" rx="14" ry="10" fill="url(#zl-sg)" opacity="0.3" />
        <circle cx="32" cy="14" r="6" fill="#65B741" />
        <circle cx="34" cy="13" r="1.5" fill="#1B2A4A" />
        <line x1="31" y1="9" x2="29" y2="5" stroke="#65B741" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="33" y1="8" x2="32" y2="4" stroke="#65B741" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="29" cy="4.5" r="1.5" fill="#65B741" />
        <circle cx="32" cy="3.5" r="1.5" fill="#65B741" />
        {/* Speed lines */}
        <path d="M2 18 Q8 16 14 17" stroke="#2196F3" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <path d="M0 21 Q7 19 13 20" stroke="#00BCD4" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <path d="M4 24 Q9 22 15 23" stroke="#65B741" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <defs>
          <linearGradient id="zl-sg" x1="10" y1="12" x2="38" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7dcf53" />
            <stop offset="100%" stopColor="#4a9e2a" />
          </linearGradient>
        </defs>
      </svg>

      {showText && (
        <div>
          <div
            className={`${textSize} font-extrabold tracking-tight leading-none`}
            style={{
              background: "linear-gradient(90deg, #65B741, #00BCD4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ZIPPY
          </div>
          <div className={`${subTextSize} font-semibold tracking-widest ${subTextColor} uppercase mt-0.5`}>
            Managed Services
          </div>
        </div>
      )}
    </div>
  );
}
