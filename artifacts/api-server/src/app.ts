import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
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
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-email", "x-founder-key"],
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

// ── Sessions — registered before routes ───────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-insecure-secret-change-me";
const IS_PRODUCTION = process.env.REPLIT_DEPLOYMENT === "1";

app.use(
  session({
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

// ── Global rate limiter — 300 req/min per IP ──────────────────────────────────
app.use("/api", globalLimiter);

// ── Static file uploads ───────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/api/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ── API router ────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
