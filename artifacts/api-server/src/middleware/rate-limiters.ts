import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function safeIpKey(req: Request): string {
  return ipKeyGenerator(req.ip ?? "unknown");
}

// Global limiter — 300 requests/min per IP
export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Anfragen. Bitte kurz warten." },
  skip: (req) => req.method === "OPTIONS",
});

// Strict limiter — 20 requests/15 min, keyed by user email or IP
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Zu viele Versuche. Bitte 15 Minuten warten." },
  keyGenerator: (req) => {
    const email = req.headers["x-user-email"] as string | undefined;
    return email?.trim() || safeIpKey(req);
  },
});

// AI limiter — 30 AI calls/hour, keyed by user email or IP (prevents OpenAI cost abuse)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "KI-Anfrage-Limit erreicht. Bitte sp\u00e4ter erneut versuchen." },
  keyGenerator: (req) => {
    const email = req.headers["x-user-email"] as string | undefined;
    return email?.trim() || safeIpKey(req);
  },
});
