import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";
import { globalLimiter } from "./middleware/rate-limiters";
import path from "path";

const app: Express = express();

// Trust the reverse proxy (Replit uses a proxy layer in front of Node).
// Required for express-rate-limit to correctly identify client IPs from X-Forwarded-For.
app.set("trust proxy", 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow credentials from any Replit preview/dev domain and the production domain.
const ALLOWED_ORIGIN_PATTERN = /\.repl(it|\.co|\.dev)\.com$|\.replit\.app$|^http:\/\/localhost/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin), curl, and matched domains
    if (!origin || ALLOWED_ORIGIN_PATTERN.test(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // still allow for now — log suspicious origins
      logger.warn({ origin }, "CORS: request from unexpected origin");
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "x-founder-key", "x-super-admin-key", "X-CSRF-Token"],
}));

// ── Stripe Webhook — MUST be registered BEFORE express.json() ────────────────
// Stripe requires the raw Buffer body for HMAC signature verification.
// express.json() would parse it into an object and break verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      logger.warn("Stripe webhook received without signature");
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }

    if (!Buffer.isBuffer(req.body)) {
      logger.error("Stripe webhook body is not a Buffer — express.json() middleware conflict");
      return res.status(500).json({ error: "Webhook body parsing error" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body, sig);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook processing error");
      return res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

// ── Sessions — PostgreSQL-backed, persistent across restarts ──────────────────
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
const IS_PRODUCTION = process.env.REPLIT_DEPLOYMENT === "1";

const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "sessions",
      pruneSessionInterval: 60 * 15, // prune expired sessions every 15 min
      errorLog: (err) => logger.error({ err }, "Session store error"),
    }),
    name: "restosmart.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// ── Body parsing (2 MB limit) — registered AFTER the webhook route ────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── CSRF Protection ───────────────────────────────────────────────────────────
// Synchronizer Token Pattern: every mutating API request from an authenticated
// session must include an X-CSRF-Token header matching the session-bound token.
//
// Bypassed routes (no session / customer-facing):
//   - /api/auth/*  (pre-auth — cannot have CSRF token yet)
//   - /api/stripe/webhook  (handled by Stripe HMAC; raw body)
//   - /api/campaigns/:id/mark-converted  (customer-facing booking event)
//
const CSRF_BYPASS = /^\/api\/(auth|stripe\/webhook)($|\/)|\/mark-converted$/;

app.use((req: Request, res: Response, next: NextFunction) => {
  const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];
  if (!MUTATING.includes(req.method)) return next();
  if (CSRF_BYPASS.test(req.path)) return next();

  // Only enforce for authenticated sessions (unauthenticated mutations
  // will be rejected by role guards later)
  if (!req.session.userEmail) return next();

  const sessionToken = req.session.csrfToken;
  const requestToken = req.headers["x-csrf-token"] as string | undefined;

  if (!sessionToken || !requestToken || sessionToken !== requestToken) {
    logger.warn({ path: req.path, method: req.method }, "CSRF token mismatch");
    return res.status(403).json({ error: "Ungültiger CSRF-Token. Bitte Seite neu laden." });
  }

  next();
});

// ── Global rate limiter — 300 req/min per IP ──────────────────────────────────
app.use("/api", globalLimiter);

// ── Static file uploads ───────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/api/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ── API router ────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
