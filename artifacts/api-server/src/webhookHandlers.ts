/**
 * webhookHandlers.ts — Stripe webhook processing
 *
 * Handles:
 *  - checkout.session.completed  → activate subscription or credit wallet
 *  - invoice.paid                → renew subscription
 *  - invoice.payment_failed      → flag subscription as past_due
 *  - customer.subscription.updated / deleted → sync subscription state
 *  - payment_intent.succeeded / payment_failed → wallet topup confirmation
 *
 * Idempotency: every event is recorded in stripe_webhook_events to prevent
 * duplicate processing. Duplicate events are silently ignored.
 */

import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { db } from "@workspace/db";
import { subscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

// ── Idempotency guard ─────────────────────────────────────────────────────────

async function isDuplicateEvent(eventId: string): Promise<boolean> {
  const rows = await db.execute(
    sql`SELECT id FROM stripe_webhook_events WHERE stripe_event_id = ${eventId} LIMIT 1`
  );
  return rows.rows.length > 0;
}

async function recordEvent(
  eventId: string,
  eventType: string,
  restaurantId: number | null,
  result: string
) {
  await db.execute(sql`
    INSERT INTO stripe_webhook_events (stripe_event_id, event_type, restaurant_id, result)
    VALUES (${eventId}, ${eventType}, ${restaurantId}, ${result})
    ON CONFLICT (stripe_event_id) DO NOTHING
  `);
}

// ── Subscription helpers ──────────────────────────────────────────────────────

async function activateSubscription(opts: {
  restaurantId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripeSessionId: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  const rows = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.restaurantId, opts.restaurantId));
  const existing = rows[0];

  if (!existing) {
    await db.insert(subscriptionsTable).values({
      restaurantId: opts.restaurantId,
      status: "active",
      planName: "RestoSmart Business Premium",
      amountEur: "39.90",
      stripeSessionId: opts.stripeSessionId,
      stripeCustomerId: opts.stripeCustomerId,
      stripeSubscriptionId: opts.stripeSubscriptionId,
      currentPeriodStart: opts.periodStart,
      currentPeriodEnd: opts.periodEnd,
      cancelledAt: null,
    });
  } else {
    await db.update(subscriptionsTable)
      .set({
        status: "active",
        planName: "RestoSmart Business Premium",
        amountEur: "39.90",
        stripeSessionId: opts.stripeSessionId,
        stripeCustomerId: opts.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        currentPeriodStart: opts.periodStart,
        currentPeriodEnd: opts.periodEnd,
        cancelledAt: null,
      })
      .where(eq(subscriptionsTable.restaurantId, opts.restaurantId));
  }
}

async function creditWallet(opts: {
  restaurantId: number;
  amount: number;
  stripePaymentIntentId: string;
  description: string;
}) {
  const balResult = await db.execute(sql`
    SELECT COALESCE(SUM(CASE WHEN type = 'topup' OR type = 'refund' THEN amount ELSE -amount END), 0) AS balance
    FROM wallet_transactions WHERE restaurant_id = ${opts.restaurantId}
  `);
  const currentBalance = parseFloat((balResult.rows[0] as any)?.balance ?? "0");
  const newBalance = Math.round((currentBalance + opts.amount) * 100) / 100;

  await db.execute(sql`
    INSERT INTO wallet_transactions (restaurant_id, type, amount, description, balance_after)
    VALUES (${opts.restaurantId}, 'topup', ${opts.amount}, ${opts.description}, ${newBalance})
  `);

  logger.info({ restaurantId: opts.restaurantId, amount: opts.amount, newBalance }, "Wallet credited via Stripe");
}

// ── Main webhook processor ────────────────────────────────────────────────────

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
        "Received type: " + typeof payload + ". " +
        "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    // 1. Let stripe-replit-sync verify signature + sync to stripe schema tables
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // 2. Parse event for our custom business logic (signature already verified above)
    let event: any;
    try {
      event = JSON.parse(payload.toString());
    } catch {
      logger.error("Failed to parse webhook payload");
      return;
    }

    const eventId = event.id as string;
    const eventType = event.type as string;

    // 3. Idempotency check
    if (await isDuplicateEvent(eventId)) {
      logger.info({ eventId, eventType }, "Duplicate webhook event — ignored");
      return;
    }

    logger.info({ eventId, eventType }, "Processing Stripe webhook event");

    try {
      await WebhookHandlers.handleBusinessLogic(event);
      await recordEvent(eventId, eventType, null, "processed");
    } catch (err: any) {
      logger.error({ err, eventId, eventType }, "Error in webhook business logic");
      await recordEvent(eventId, eventType, null, `error: ${err.message}`);
      throw err;
    }
  }

  private static async handleBusinessLogic(event: any): Promise<void> {
    const eventType: string = event.type;
    const data = event.data?.object;

    switch (eventType) {

      // ── Checkout completed ──────────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = data;
        const meta = session.metadata ?? {};
        const restaurantId = parseInt(meta.restaurant_id ?? "0", 10);
        const paymentStatus = session.payment_status;

        if (!restaurantId || restaurantId <= 0) {
          logger.warn({ meta }, "Webhook: missing or invalid restaurant_id in metadata — skipping");
          return;
        }

        logger.info({ eventType, restaurantId, mode: session.mode, paymentStatus }, "Checkout session completed");

        if (session.mode === "subscription" && meta.type === "subscription") {
          if (paymentStatus !== "paid") {
            logger.warn({ eventType, restaurantId, paymentStatus }, "Subscription checkout not paid — skipping activation");
            return;
          }

          // Resolve subscription period from Stripe subscription object
          let periodStart = new Date();
          let periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

          if (session.subscription) {
            try {
              const stripe = await getUncachableStripeClient();
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              periodStart = new Date((sub as any).current_period_start * 1000);
              periodEnd = new Date((sub as any).current_period_end * 1000);
            } catch (err) {
              logger.warn({ err }, "Could not retrieve subscription details — using 30d default");
            }
          }

          await activateSubscription({
            restaurantId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string | null,
            stripeSessionId: session.id as string,
            periodStart,
            periodEnd,
          });

          logger.info({ restaurantId }, "Subscription activated via checkout.session.completed");
        }

        if (session.mode === "payment" && meta.type === "wallet_topup") {
          const amount = parseFloat(meta.topup_amount ?? "0");
          if (amount <= 0) {
            logger.warn({ meta }, "Wallet topup amount invalid — skipping credit");
            return;
          }

          if (paymentStatus !== "paid") {
            logger.warn({ restaurantId, paymentStatus }, "Wallet topup not paid — skipping credit");
            return;
          }

          await creditWallet({
            restaurantId,
            amount,
            stripePaymentIntentId: session.payment_intent as string,
            description: `Guthaben aufgeladen via Stripe: \u20AC${amount.toFixed(2)}`,
          });
        }
        break;
      }

      // ── Invoice paid (recurring subscription renewal) ──────────────────────
      case "invoice.paid": {
        const invoice = data;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        logger.info({ eventType, subscriptionId }, "Invoice paid — renewing subscription");

        try {
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const customerId = sub.customer as string;
          const periodStart = new Date((sub as any).current_period_start * 1000);
          const periodEnd = new Date((sub as any).current_period_end * 1000);
          const meta = (sub as any).metadata ?? {};
          const restaurantId = parseInt(meta.restaurant_id ?? "0", 10);

          // Find our subscription by stripeSubscriptionId or stripeCustomerId
          const rows = await db.execute(sql`
            SELECT * FROM subscriptions WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1
          `);
          const rid = rows.rows.length > 0
            ? (rows.rows[0] as any).restaurant_id as number
            : restaurantId;

          await db.update(subscriptionsTable)
            .set({
              status: "active",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelledAt: null,
            })
            .where(eq(subscriptionsTable.restaurantId, rid));

          logger.info({ restaurantId: rid, periodEnd }, "Subscription renewed via invoice.paid");
        } catch (err) {
          logger.error({ err, subscriptionId }, "Failed to renew subscription from invoice.paid");
          throw err;
        }
        break;
      }

      // ── Invoice payment failed ─────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = data;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        logger.warn({ eventType, subscriptionId }, "Invoice payment failed — marking past_due");

        const rows = await db.execute(sql`
          SELECT restaurant_id FROM subscriptions WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1
        `);
        if (rows.rows.length > 0) {
          const rid = (rows.rows[0] as any).restaurant_id as number;
          await db.update(subscriptionsTable)
            .set({ status: "past_due" })
            .where(eq(subscriptionsTable.restaurantId, rid));
          logger.warn({ restaurantId: rid }, "Subscription marked past_due");
        }
        break;
      }

      // ── Subscription updated ───────────────────────────────────────────────
      case "customer.subscription.updated": {
        const sub = data;
        const subscriptionId = sub.id as string;
        const stripeStatus = sub.status as string;

        const rows = await db.execute(sql`
          SELECT restaurant_id FROM subscriptions WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1
        `);
        if (rows.rows.length === 0) break;

        const rid = (rows.rows[0] as any).restaurant_id as number;

        let newStatus: string;
        if (stripeStatus === "active") newStatus = "active";
        else if (stripeStatus === "past_due") newStatus = "past_due";
        else if (stripeStatus === "canceled") newStatus = "cancelled";
        else if (stripeStatus === "unpaid") newStatus = "past_due";
        else newStatus = "inactive";

        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000) : undefined;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000) : undefined;

        await db.update(subscriptionsTable)
          .set({
            status: newStatus,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelledAt: stripeStatus === "canceled" ? new Date() : null,
          })
          .where(eq(subscriptionsTable.restaurantId, rid));

        logger.info({ restaurantId: rid, stripeStatus, newStatus }, "Subscription updated via webhook");
        break;
      }

      // ── Subscription deleted (canceled) ───────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = data;
        const subscriptionId = sub.id as string;

        const rows = await db.execute(sql`
          SELECT restaurant_id FROM subscriptions WHERE stripe_subscription_id = ${subscriptionId} LIMIT 1
        `);
        if (rows.rows.length === 0) break;

        const rid = (rows.rows[0] as any).restaurant_id as number;
        await db.update(subscriptionsTable)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(eq(subscriptionsTable.restaurantId, rid));

        logger.info({ restaurantId: rid }, "Subscription cancelled via customer.subscription.deleted");
        break;
      }

      // ── Payment intent succeeded (extra safety for wallet topup) ──────────
      case "payment_intent.succeeded": {
        // Handled by checkout.session.completed for our wallet topup flow
        // This is a backup for any direct Payment Intent flows in the future
        logger.info({ eventType, piId: data.id }, "payment_intent.succeeded — no-op (handled by checkout)");
        break;
      }

      // ── Payment intent failed ─────────────────────────────────────────────
      case "payment_intent.payment_failed": {
        logger.warn({ eventType, piId: data.id }, "payment_intent.payment_failed — logged");
        break;
      }

      default:
        logger.info({ eventType }, "Unhandled webhook event type — skipped");
    }
  }
}
