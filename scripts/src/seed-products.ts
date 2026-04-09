/**
 * seed-products.ts — Create RestoSmart products and prices in Stripe
 *
 * Products:
 *  1. "RestoSmart Business Premium" — recurring monthly €39.90/month EUR
 *  2. "RestoSmart Wallet Topup" — one-time prices: €5, €10, €20, €50 EUR
 *
 * Idempotent: checks for existing products before creating.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

import Stripe from "stripe";
import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  // Display which mode we're running in for safety
  const keyHint = (process.env.STRIPE_SECRET_KEY ?? "").substring(0, 12) || "connector";
  const mode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live") ? "LIVE" : "TEST";
  console.log(`=== Stripe Seed Script — ${mode} MODE ===`);
  if (mode === "LIVE") {
    console.log(`Key: ${keyHint}...`);
    console.log("WARNING: Creating LIVE products that will charge real money!\n");
  } else {
    console.log("Running in test/sandbox mode.\n");
  }

  console.log("Creating RestoSmart products and prices in Stripe...\n");

  // ── 1. RestoSmart Business Premium ─────────────────────────────────────────
  {
    const existing = await stripe.products.search({
      query: "name:'RestoSmart Business Premium' AND active:'true'",
    });

    if (existing.data.length > 0) {
      console.log("RestoSmart Business Premium already exists — skipping.");
      const product = existing.data[0];

      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        recurring: { interval: "month" } as any,
      });

      if (prices.data.length > 0) {
        const price = prices.data[0];
        console.log(`  Existing price: ${price.id} (${price.unit_amount ? price.unit_amount / 100 : "?"} EUR/month)`);
      } else {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: 3990,
          currency: "eur",
          recurring: { interval: "month" },
          nickname: "RestoSmart Business Premium — Monthly",
        });
        console.log(`  Created price: ${price.id} (39.90 EUR/month)`);
      }
    } else {
      const product = await stripe.products.create({
        name: "RestoSmart Business Premium",
        description: "Vollzugriff auf das RestoSmart Business Dashboard. Boost-Tools, KI-Antworten, ROI-Engine, Analytics und mehr.",
        metadata: {
          platform: "restosmart",
          type: "subscription",
        },
      });
      console.log(`Created product: ${product.name} (${product.id})`);

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 3990,
        currency: "eur",
        recurring: { interval: "month" },
        nickname: "RestoSmart Business Premium — Monthly",
      });
      console.log(`Created price: ${price.id} (39.90 EUR/month)`);
    }
  }

  // ── 2. RestoSmart Wallet Topup ──────────────────────────────────────────────
  {
    const existing = await stripe.products.search({
      query: "name:'RestoSmart Wallet Topup' AND active:'true'",
    });

    const TOPUP_AMOUNTS = [5, 10, 20, 50] as const;
    let product: { id: string; name: string };

    if (existing.data.length > 0) {
      console.log("\nRestoSmart Wallet Topup already exists — checking prices.");
      product = existing.data[0] as any;
    } else {
      product = await stripe.products.create({
        name: "RestoSmart Wallet Topup",
        description: "Guthaben f\u00fcr RestoSmart Boost-Wallet aufladen. F\u00fcr das Schalten von Boosts im Dashboard.",
        metadata: {
          platform: "restosmart",
          type: "wallet_topup",
        },
      }) as any;
      console.log(`\nCreated product: ${product.name} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({ product: product.id, active: true });
    const existingCents = new Set(existingPrices.data.map((p) => p.unit_amount));

    for (const amount of TOPUP_AMOUNTS) {
      const cents = amount * 100;
      if (existingCents.has(cents)) {
        const ep = existingPrices.data.find((p) => p.unit_amount === cents);
        console.log(`  Wallet \u20AC${amount} already exists — ${ep?.id}`);
        continue;
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: cents,
        currency: "eur",
        nickname: `RestoSmart Wallet Topup — \u20AC${amount}`,
        metadata: { topup_amount: String(amount) },
      });
      console.log(`  Created wallet topup price: ${price.id} (\u20AC${amount})`);
    }
  }

  console.log("\n=== Seed complete ===");
  console.log(`Mode: ${mode}`);
  console.log("Webhook sync will populate the stripe schema tables automatically when the server starts.");
}

createProducts().catch((err) => {
  console.error("Error seeding products:", err.message);
  process.exit(1);
});
