import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="16" fill="url(#logoGrad)" />
      <path
        d="M18 46V18h15.5c2.8 0 5.1.9 6.9 2.6 1.8 1.7 2.7 3.9 2.7 6.5 0 1.9-.5 3.6-1.5 5s-2.3 2.5-4 3.1l7 10.8H38l-6.4-10H23.5v10H18zm5.5-14.5h9.7c1.6 0 2.9-.5 3.8-1.4.9-.9 1.4-2.1 1.4-3.6s-.5-2.7-1.4-3.6c-.9-.9-2.2-1.4-3.8-1.4H23.5v10z"
        fill="white"
      />
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e07c3a" />
          <stop offset="1" stopColor="#c05a1a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Login() {
  const { user, isLoading, signInWithGoogle, signInWithApple } = useAuth();
  const [, navigate] = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (!isLoading && user && !redirected.current) {
      redirected.current = true;
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || user) return null;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0d0d0d] relative overflow-hidden">
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#e07c3a]/8 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#c05a1a]/6 blur-[100px]" />
        <div className="absolute top-[30%] right-[-5%] w-[300px] h-[300px] rounded-full bg-[#e07c3a]/5 blur-[80px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-[#141414] border border-white/[0.07] rounded-3xl p-10 shadow-2xl shadow-black/60 backdrop-blur-sm">

          {/* Logo + Wordmark */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-5 drop-shadow-[0_0_24px_rgba(224,124,58,0.35)]">
              <LogoMark size={72} />
            </div>

            <h1
              className="text-[28px] font-bold tracking-tight text-white mb-2"
              style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", letterSpacing: "-0.03em" }}
            >
              RestoSmart
            </h1>

            <p className="text-[13.5px] text-center text-white/45 leading-relaxed max-w-[220px]">
              Die intelligente Plattform für modernes Restaurantmanagement
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[11px] font-medium text-white/25 tracking-wider uppercase">Weiter mit</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Auth Buttons */}
          <div className="space-y-3">
            {/* Apple */}
            <button
              onClick={signInWithApple}
              className="group w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white text-[#0d0d0d] text-[14px] font-semibold transition-all duration-200 hover:bg-white/90 active:scale-[0.98] shadow-md shadow-black/30"
            >
              <AppleIcon />
              <span>Weiter mit Apple</span>
            </button>

            {/* Google */}
            <button
              onClick={signInWithGoogle}
              className="group w-full flex items-center justify-center gap-3 h-12 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white text-[14px] font-medium transition-all duration-200 hover:bg-white/[0.10] hover:border-white/[0.14] active:scale-[0.98]"
            >
              <GoogleIcon />
              <span>Weiter mit Google</span>
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-8 text-center text-[11px] text-white/20 leading-relaxed">
            Durch die Anmeldung stimmen Sie unseren{" "}
            <span className="text-white/35 cursor-pointer hover:text-white/50 transition-colors">Nutzungsbedingungen</span>{" "}
            und{" "}
            <span className="text-white/35 cursor-pointer hover:text-white/50 transition-colors">Datenschutzrichtlinien</span>{" "}
            zu.
          </p>
        </div>

        {/* Bottom badge */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-pulse" />
          <span className="text-[11px] text-white/20 tracking-wide">Sicher &amp; verschlüsselt</span>
        </div>
      </div>
    </div>
  );
}
