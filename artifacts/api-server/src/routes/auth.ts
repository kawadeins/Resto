/**
 * Auth routes — server-side session management for the business dashboard.
 *
 * Two-step OTP login:
 *   POST /api/auth/request-otp  — validate email in DB, generate 6-digit code
 *   POST /api/auth/verify-otp   — validate code, create session
 *   GET  /api/auth/session       — return current session user
 *   POST /api/auth/logout        — destroy session
 *
 * In development (no RESEND_API_KEY), the OTP code is returned in the
 * response body so the login form can display it. In production with
 * RESEND_API_KEY set, the code is sent by email and NOT returned in the body.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import crypto from "crypto";
import { otpRequestLimiter, otpVerifyLimiter } from "../middleware/rate-limiters";
import { logger } from "../lib/logger";
import { resolveIdentity } from "../lib/identity";

const router = Router();
const OTP_TTL_MINUTES = 10;
const DEV_MODE = !process.env.RESEND_API_KEY;

// Resend client — only used when API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ── OTP generation ────────────────────────────────────────────────────────────

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── POST /api/auth/request-otp ────────────────────────────────────────────────

const requestOtpSchema = z.object({
  email: z.string().email().max(320),
});

router.post("/request-otp", otpRequestLimiter, async (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ungültige E-Mail-Adresse" });
  }

  const email = parsed.data.email.trim().toLowerCase();

  // Always validate identity before issuing any OTP
  const identity = await resolveIdentity(email);
  if (!identity) {
    // Return same shape as success to not leak account existence
    // (but still 401 so the frontend can differentiate)
    return res
      .status(401)
      .json({ error: "Kein aktives Konto für diese E-Mail-Adresse gefunden" });
  }

  // Invalidate any previous unused OTPs for this email
  await db.execute(sql`
    UPDATE auth_otps SET used = TRUE
    WHERE email = ${email} AND used = FALSE
  `);

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.execute(sql`
    INSERT INTO auth_otps (email, code, expires_at, used)
    VALUES (${email}, ${code}, ${expiresAt.toISOString()}, FALSE)
  `);

  // Send email if Resend is available
  if (resend) {
    try {
      await resend.emails.send({
        from: "RestoSmart <noreply@restosmart.app>",
        to: email,
        subject: "Ihr Anmeldecode für RestoSmart",
        html: `
          <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0a;color:#f9fafb;border-radius:12px;">
            <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">RestoSmart</h1>
            <p style="color:#9ca3af;margin:0 0 32px;">Ihr Anmeldecode</p>
            <div style="background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#a78bfa;">${code}</span>
            </div>
            <p style="color:#6b7280;font-size:14px;">
              Dieser Code ist ${OTP_TTL_MINUTES} Minuten gültig.<br/>
              Falls Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail bitte.
            </p>
          </div>
        `,
      });
    } catch (err) {
      logger.error({ err }, "Failed to send OTP email via Resend");
    }
    return res.json({ sent: true });
  }

  // Development mode — return code so the login form can display it
  logger.info({ email, code }, "DEV MODE: OTP code generated");
  return res.json({ sent: true, devCode: code });
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────

const verifyOtpSchema = z.object({
  email: z.string().email().max(320),
  code: z.string().length(6).regex(/^\d{6}$/),
});

router.post("/verify-otp", otpVerifyLimiter, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ungültiger Code" });
  }

  const { code } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();

  // Look up a valid, unused OTP for this email
  const rows = await db.execute(sql`
    SELECT id, expires_at FROM auth_otps
    WHERE email = ${email}
      AND code = ${code}
      AND used = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const otp = rows.rows[0] as { id: number; expires_at: string } | undefined;

  if (!otp) {
    return res
      .status(401)
      .json({ error: "Ungültiger oder abgelaufener Code. Bitte neuen Code anfordern." });
  }

  // Mark OTP as used immediately (prevent replay)
  await db.execute(sql`
    UPDATE auth_otps SET used = TRUE WHERE id = ${otp.id}
  `);

  // Re-validate identity (role may have changed since OTP was issued)
  const identity = await resolveIdentity(email);
  if (!identity) {
    return res
      .status(401)
      .json({ error: "Kein aktives Konto für diese E-Mail-Adresse gefunden" });
  }

  // Generate a fresh CSRF token for this session
  const csrfToken = crypto.randomBytes(32).toString("hex");

  req.session.userEmail = email;
  req.session.role = identity.role;
  req.session.restaurantId = identity.restaurantId;
  req.session.csrfToken = csrfToken;

  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );

  return res.json({
    email: req.session.userEmail,
    role: req.session.role,
    restaurantId: req.session.restaurantId,
    csrfToken,
  });
});

// ── GET /api/auth/session ─────────────────────────────────────────────────────

router.get("/session", (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ authenticated: false });
  }
  // Ensure every authenticated session has a CSRF token
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    req.session.save(() => {});
  }
  return res.json({
    authenticated: true,
    email: req.session.userEmail,
    role: req.session.role,
    restaurantId: req.session.restaurantId,
    csrfToken: req.session.csrfToken,
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("restosmart.sid");
    return res.json({ success: true });
  });
});

export default router;
