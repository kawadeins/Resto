import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function safeIpKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

// Session-aware key generator: prefer session email → IP
function sessionOrIpKey(req: Request): string {
  const sessionEmail = (req as any).session?.userEmail as string | undefined;
  return sessionEmail?.trim() || safeIpKey(req);
}

// ── Global limiter — 300 requests/min per IP ─────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte kurz warten." },
  skip: (req) => req.method === "OPTIONS",
});

// ── Strict limiter — 10 requests/15 min (auth, sensitive ops) ────────────────
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Versuche. Bitte 15 Minuten warten." },
  keyGenerator: safeIpKey,
});

// ── OTP request limiter — 5 OTPs per 15 min per IP ───────────────────────────
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Code-Anfragen. Bitte 15 Minuten warten." },
  keyGenerator: safeIpKey,
});

// ── OTP verify limiter — 10 attempts/15 min per IP ───────────────────────────
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anmeldeversuche. Bitte 15 Minuten warten." },
  keyGenerator: safeIpKey,
});

// ── Wallet top-up limiter — 5 top-ups/15 min per user ───────────────────────
export const walletTopupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Auflade-Versuche. Bitte kurz warten." },
  keyGenerator: sessionOrIpKey,
});

// ── Team invite limiter — 20 invites/hour per user ───────────────────────────
export const teamInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Einladungs-Limit erreicht. Bitte später erneut versuchen." },
  keyGenerator: sessionOrIpKey,
});

// ── Boost activation limiter — 30 boost activations/hour per user ────────────
export const boostActivationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Boost-Aktivierungen. Bitte später versuchen." },
  keyGenerator: sessionOrIpKey,
});

// ── AI limiter — 30 AI calls/hour per user (prevents OpenAI cost abuse) ──────
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "KI-Anfrage-Limit erreicht. Bitte später erneut versuchen." },
  keyGenerator: sessionOrIpKey,
});

// ── Dashboard mutation limiter — 100 mutations/15 min per user ───────────────
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Aktionen. Bitte kurz warten." },
  keyGenerator: sessionOrIpKey,
});

// ── Review submission limiter — 5 reviews per 10 min per IP (anti-spam) ──────
export const reviewSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Bewertungen. Bitte 10 Minuten warten." },
  keyGenerator: safeIpKey,
});

// ── Business claim limiter — 3 claims per hour per IP ────────────────────────
export const businessClaimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
  keyGenerator: safeIpKey,
});
