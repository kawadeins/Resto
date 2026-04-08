import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Stripe initialization ─────────────────────────────────────────────────────
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — Stripe initialization skipped");
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    const { runMigrations } = await import("stripe-replit-sync");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const { getStripeSync } = await import("./stripeClient");
    const stripeSync = await getStripeSync();

    const domains = process.env.REPLIT_DOMAINS ?? "";
    const webhookBaseUrl = `https://${domains.split(",")[0]}`;
    const webhookResult = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    logger.info({ url: webhookResult?.webhook?.url }, "Stripe webhook configured");

    // Run syncBackfill in background — non-blocking so server starts fast
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: any) => logger.error({ err }, "Stripe syncBackfill error"));
  } catch (err: any) {
    logger.error({ err }, "Stripe initialization failed — server continues without Stripe sync");
  }
}

// Initialize Stripe (non-blocking failures) then start the server
initStripe().finally(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
