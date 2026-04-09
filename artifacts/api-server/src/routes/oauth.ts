/**
 * OAuth routes — Google and Apple sign-in for the business dashboard.
 *
 * Both flows end in the same server-side session created by verify-otp.
 * After OAuth, resolveIdentity() matches the email to an existing
 * owner or team member — no auto-registration, no open sign-up.
 *
 * Routes:
 *   GET  /api/auth/oauth/providers         — which providers are configured
 *   GET  /api/auth/google                  — start Google OAuth
 *   GET  /api/auth/google/callback         — Google OAuth callback
 *   GET  /api/auth/apple                   — start Apple Sign-In
 *   POST /api/auth/apple/callback          — Apple Sign-In callback (Apple always POSTs)
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
 *   OAUTH_CALLBACK_BASE_URL  (optional — auto-detected from REPLIT_DEV_DOMAIN)
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { SignJWT, jwtVerify, createRemoteJWKSet, importPKCS8 } from "jose";
import { resolveIdentity } from "../lib/identity";
import { logger } from "../lib/logger";

const router = Router();

// ── Configuration ──────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  if (process.env.OAUTH_CALLBACK_BASE_URL) {
    return process.env.OAUTH_CALLBACK_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:8080";
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;

const googleConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const appleConfigured = !!(APPLE_CLIENT_ID && APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);

// Apple JWKS — fetched lazily and cached by jose
const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

// ── Provider status (frontend polls this to show/hide buttons) ─────────────────

router.get("/providers", (_req, res) => {
  return res.json({ google: googleConfigured, apple: appleConfigured });
});

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** HTML page that immediately redirects — needed for Apple's POST callback. */
function htmlRedirect(url: string): string {
  const safe = url.replace(/"/g, "&quot;");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Weiterleitung…</title>
<meta http-equiv="refresh" content="0;url=${safe}">
</head><body><script>window.location.replace(${JSON.stringify(url)});</script>
<p>Wird weitergeleitet…</p></body></html>`;
}

/**
 * After identity is verified, create the server-side session and redirect.
 * redirectMode "redirect" → HTTP 302; "html" → auto-redirect HTML page.
 */
async function createOAuthSession(
  req: Request,
  res: Response,
  email: string,
  provider: string,
  sub: string,
  redirectMode: "redirect" | "html",
): Promise<void> {
  const identity = await resolveIdentity(email);

  if (!identity) {
    const url = `/?login_error=no_account&provider=${provider}`;
    if (redirectMode === "html") {
      res.send(htmlRedirect(url));
    } else {
      res.redirect(url);
    }
    return;
  }

  // Upsert oauth account mapping so we can re-resolve email on future logins
  await db.execute(sql`
    INSERT INTO oauth_accounts (provider, provider_sub, email)
    VALUES (${provider}, ${sub}, ${email.toLowerCase()})
    ON CONFLICT (provider, provider_sub) DO NOTHING
  `);

  const csrfToken = crypto.randomBytes(32).toString("hex");
  req.session.userEmail = email.toLowerCase();
  req.session.role = identity.role;
  req.session.restaurantId = identity.restaurantId;
  req.session.csrfToken = csrfToken;

  await new Promise<void>((resolve, reject) =>
    req.session.save((err) => (err ? reject(err) : resolve())),
  );

  logger.info({ email, role: identity.role, provider }, "OAuth session created");

  if (redirectMode === "html") {
    res.send(htmlRedirect("/"));
  } else {
    res.redirect("/");
  }
}

// ── Google OAuth ───────────────────────────────────────────────────────────────

router.get("/google", (req, res) => {
  if (!googleConfigured) {
    return res.status(503).json({ error: "Google-Anmeldung ist nicht konfiguriert" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  req.session.save(() => {
    const callbackUrl = `${getBaseUrl()}/api/auth/google/callback`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  });
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`/?login_error=cancelled&provider=google`);
    }
    if (!code || !state || state !== req.session.oauthState) {
      logger.warn({ state, sessionState: req.session.oauthState }, "Google OAuth state mismatch");
      return res.redirect(`/?login_error=invalid&provider=google`);
    }
    delete req.session.oauthState;

    const callbackUrl = `${getBaseUrl()}/api/auth/google/callback`;

    // Exchange code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      logger.error({ status: tokenRes.status, body }, "Google token exchange failed");
      return res.redirect(`/?login_error=auth_failed&provider=google`);
    }

    const tokens = (await tokenRes.json()) as { access_token?: string };

    if (!tokens.access_token) {
      return res.redirect(`/?login_error=auth_failed&provider=google`);
    }

    // Get user info with access token
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      logger.error({ status: userInfoRes.status }, "Google userinfo fetch failed");
      return res.redirect(`/?login_error=auth_failed&provider=google`);
    }

    const userInfo = (await userInfoRes.json()) as {
      email?: string;
      sub?: string;
      email_verified?: boolean;
    };

    if (!userInfo.email || !userInfo.email_verified) {
      return res.redirect(`/?login_error=no_email&provider=google`);
    }

    await createOAuthSession(
      req, res,
      userInfo.email,
      "google",
      userInfo.sub ?? userInfo.email,
      "redirect",
    );
  } catch (err) {
    logger.error({ err }, "Google OAuth callback error");
    res.redirect(`/?login_error=auth_failed&provider=google`);
  }
});

// ── Apple Sign-In ──────────────────────────────────────────────────────────────

/** Build the ES256 client_secret JWT Apple requires for token exchange. */
async function buildAppleClientSecret(): Promise<string> {
  const pem = APPLE_PRIVATE_KEY!.includes("-----")
    ? APPLE_PRIVATE_KEY!
    : Buffer.from(APPLE_PRIVATE_KEY!, "base64").toString("utf-8");

  const privateKey = await importPKCS8(pem, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID })
    .setIssuer(APPLE_TEAM_ID!)
    .setSubject(APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

router.get("/apple", (req, res) => {
  if (!appleConfigured) {
    return res.status(503).json({ error: "Apple-Anmeldung ist nicht konfiguriert" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;

  req.session.save(() => {
    const callbackUrl = `${getBaseUrl()}/api/auth/apple/callback`;
    const params = new URLSearchParams({
      client_id: APPLE_CLIENT_ID!,
      redirect_uri: callbackUrl,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: "email",
      state,
    });
    res.redirect(`https://appleid.apple.com/auth/authorize?${params}`);
  });
});

// Apple always sends a form POST to the callback URL
router.post("/apple/callback", async (req, res) => {
  res.setHeader("Content-Type", "text/html");

  try {
    const { id_token, state, error } = req.body as Record<string, string>;

    if (error) {
      return res.send(htmlRedirect(`/?login_error=cancelled&provider=apple`));
    }
    if (!id_token || !state || state !== req.session.oauthState) {
      logger.warn("Apple OAuth: state mismatch or missing id_token");
      return res.send(htmlRedirect(`/?login_error=invalid&provider=apple`));
    }
    delete req.session.oauthState;

    // Verify id_token with Apple's public JWKS
    const { payload } = await jwtVerify(id_token, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: APPLE_CLIENT_ID,
    });

    const sub = payload.sub as string;
    let email = payload.email as string | undefined;

    if (!email) {
      // Apple only sends email on first sign-in; look up our stored mapping
      const row = await db.execute(sql`
        SELECT email FROM oauth_accounts
        WHERE provider = 'apple' AND provider_sub = ${sub}
        LIMIT 1
      `);
      email = (row.rows[0] as { email: string } | undefined)?.email;
    }

    if (!email) {
      logger.warn({ sub }, "Apple OAuth: no email found for user — first-time login required");
      return res.send(htmlRedirect(`/?login_error=no_email&provider=apple`));
    }

    await createOAuthSession(req, res, email, "apple", sub, "html");
  } catch (err) {
    logger.error({ err }, "Apple OAuth callback error");
    res.send(htmlRedirect(`/?login_error=auth_failed&provider=apple`));
  }
});

export default router;
