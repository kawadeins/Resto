import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const FOUNDER_KEY = process.env.FOUNDER_KEY ?? "rs_founder_2026";
const MIN_IMPRESSIONS = 40;
const WIN_ADVANTAGE = 0.20;

function founderAuth(req: any, res: any, next: any) {
  const key = req.headers["x-founder-key"] as string | undefined;
  if (!key || key !== FOUNDER_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── GET /api/variants/active?businessType=restaurant
// Returns the active variant for every element_type, preferring:
// 1. Any declared winner (always served once stable)
// 2. Weighted random (lower-impression variants get more exposure to balance data)
router.get("/active", async (req, res) => {
  try {
    const bizType = (req.query.businessType as string) ?? "all";

    const rows = await db.execute(sql`
      SELECT id, element_type, business_type, variant_key, copy_text,
             is_winner, impressions, clicks
      FROM conversion_variants
      WHERE is_retired = false
        AND (business_type = 'all' OR business_type = ${bizType})
      ORDER BY element_type, business_type DESC, variant_key
    `);

    const byElement: Record<string, any[]> = {};
    for (const row of rows.rows as any[]) {
      const et = row.element_type as string;
      if (!byElement[et]) byElement[et] = [];
      byElement[et].push(row);
    }

    const result: Record<string, { id: number; variantKey: string; copyText: string }> = {};

    for (const [elementType, variants] of Object.entries(byElement)) {
      const bizSpecific = variants.filter((v: any) => v.business_type === bizType);
      const allType = variants.filter((v: any) => v.business_type === "all");

      const pool = new Map<string, any>();
      for (const v of allType) pool.set(v.variant_key, v);
      for (const v of bizSpecific) pool.set(v.variant_key, v);
      const candidates = Array.from(pool.values());

      const winner = candidates.find((v: any) => v.is_winner);
      if (winner) {
        result[elementType] = { id: Number(winner.id), variantKey: winner.variant_key, copyText: winner.copy_text };
        continue;
      }

      // Weighted random — under-shown variants get higher weight
      let chosen = candidates[0];
      if (candidates.length > 1) {
        const weights = candidates.map((v: any) => {
          const imp = Number(v.impressions);
          return imp === 0 ? 100 : Math.max(1, Math.round(100 / (imp + 1)));
        });
        const totalW = weights.reduce((s: number, w: number) => s + w, 0);
        let rand = Math.random() * totalW;
        for (let i = 0; i < candidates.length; i++) {
          rand -= weights[i];
          if (rand <= 0) { chosen = candidates[i]; break; }
        }
      }
      result[elementType] = { id: Number(chosen.id), variantKey: chosen.variant_key, copyText: chosen.copy_text };
    }

    res.json(result);
  } catch (err) {
    console.error("variants/active error:", err);
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

// ── POST /api/variants/impression  { variantId }
router.post("/impression", async (req, res) => {
  try {
    const { variantId } = req.body;
    if (!variantId) return res.status(400).json({ error: "variantId required" });
    await db.execute(sql`
      UPDATE conversion_variants
      SET impressions = impressions + 1, updated_at = NOW()
      WHERE id = ${Number(variantId)}
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to record impression" });
  }
});

// ── POST /api/variants/click  { variantId, isConversion? }
router.post("/click", async (req, res) => {
  try {
    const { variantId, isConversion } = req.body;
    if (!variantId) return res.status(400).json({ error: "variantId required" });
    await db.execute(sql`
      UPDATE conversion_variants
      SET clicks = clicks + 1,
          conversions = conversions + ${isConversion ? 1 : 0},
          updated_at = NOW()
      WHERE id = ${Number(variantId)}
    `);
    const actions = await runAutoOptimize();
    res.json({ ok: true, autoOptimizeActions: actions });
  } catch (err) {
    res.status(500).json({ error: "Failed to record click" });
  }
});

// ── GET /api/variants/insights  (founder auth)
router.get("/insights", founderAuth, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, element_type, business_type, variant_key, copy_text,
             is_winner, is_retired, impressions, clicks, conversions,
             CASE WHEN impressions > 0 THEN ROUND(clicks::numeric / impressions * 100, 1) ELSE 0 END AS ctr,
             CASE WHEN clicks > 0 THEN ROUND(conversions::numeric / clicks * 100, 1) ELSE 0 END AS conv_rate,
             updated_at
      FROM conversion_variants
      ORDER BY element_type, business_type, ctr DESC NULLS LAST
    `);

    const byElement: Record<string, any[]> = {};
    for (const r of rows.rows as any[]) {
      const et = r.element_type as string;
      if (!byElement[et]) byElement[et] = [];
      byElement[et].push({
        id: Number(r.id),
        businessType: r.business_type,
        variantKey: r.variant_key,
        copyText: r.copy_text,
        isWinner: Boolean(r.is_winner),
        isRetired: Boolean(r.is_retired),
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        conversions: Number(r.conversions),
        ctr: Number(r.ctr),
        convRate: Number(r.conv_rate),
        updatedAt: r.updated_at,
      });
    }

    const allRows = rows.rows as any[];
    const totalVariants = allRows.length;
    const winners = allRows.filter((r: any) => r.is_winner).length;
    const retired = allRows.filter((r: any) => r.is_retired).length;
    const totalImpressions = allRows.reduce((s: number, r: any) => s + Number(r.impressions), 0);
    const totalClicks = allRows.reduce((s: number, r: any) => s + Number(r.clicks), 0);
    const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 100 * 10) / 10 : 0;

    // Best variant per element
    const best: Record<string, any> = {};
    for (const [et, variants] of Object.entries(byElement)) {
      const active = variants.filter((v: any) => !v.isRetired && v.impressions > 0);
      if (!active.length) continue;
      best[et] = active.reduce((a: any, b: any) => (b.ctr > a.ctr ? b : a));
    }

    res.json({
      summary: { totalVariants, winners, retired, totalImpressions, totalClicks, avgCtr },
      byElement,
      bestPerElement: best,
    });
  } catch (err) {
    console.error("variants/insights error:", err);
    res.status(500).json({ error: "Failed to load variant insights" });
  }
});

// ── POST /api/variants/auto-optimize  (founder trigger)
router.post("/auto-optimize", founderAuth, async (_req, res) => {
  try {
    const actions = await runAutoOptimize();
    res.json({ ok: true, actions });
  } catch (err) {
    res.status(500).json({ error: "Auto-optimize failed" });
  }
});

async function runAutoOptimize(): Promise<string[]> {
  const actions: string[] = [];
  try {
    const rows = await db.execute(sql`
      SELECT id, element_type, business_type, variant_key, copy_text,
             is_winner, impressions, clicks,
             CASE WHEN impressions > 0 THEN clicks::float / impressions ELSE 0 END AS ctr
      FROM conversion_variants
      WHERE is_retired = false
      ORDER BY element_type, business_type, ctr DESC
    `);

    const groups: Record<string, any[]> = {};
    for (const r of rows.rows as any[]) {
      const key = `${r.element_type}::${r.business_type}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...r, ctr: Number(r.ctr), impressions: Number(r.impressions), clicks: Number(r.clicks) });
    }

    for (const [key, variants] of Object.entries(groups)) {
      if (variants.length < 2) continue;

      const existingWinner = variants.find((v: any) => v.is_winner);

      if (existingWinner) {
        for (const v of variants) {
          if (v.is_winner || v.is_retired) continue;
          if (v.impressions >= MIN_IMPRESSIONS && existingWinner.ctr > 0) {
            const advantage = existingWinner.ctr / Math.max(v.ctr, 0.001);
            if (advantage >= 1 + WIN_ADVANTAGE) {
              await db.execute(sql`
                UPDATE conversion_variants SET is_retired = true, updated_at = NOW()
                WHERE id = ${Number(v.id)}
              `);
              actions.push(`RETIRED [${key}] variant ${v.variant_key}: CTR ${(v.ctr * 100).toFixed(1)}% (winner: ${(existingWinner.ctr * 100).toFixed(1)}%)`);
            }
          }
        }
        continue;
      }

      // Check for new winner
      const best = variants[0];
      if (best.impressions < MIN_IMPRESSIONS) continue;
      const runners = variants.filter((v: any) => v.id !== best.id && v.impressions >= MIN_IMPRESSIONS);
      if (!runners.length) continue;

      const worst = runners.reduce((a: any, b: any) => (b.ctr < a.ctr ? b : a));
      const advantage = best.ctr / Math.max(worst.ctr, 0.001);

      if (advantage >= 1 + WIN_ADVANTAGE) {
        await db.execute(sql`
          UPDATE conversion_variants SET is_winner = true, updated_at = NOW()
          WHERE id = ${Number(best.id)}
        `);
        actions.push(`WINNER [${key}] variant ${best.variant_key}: CTR ${(best.ctr * 100).toFixed(1)}% vs ${(worst.ctr * 100).toFixed(1)}%`);
      }
    }
  } catch (err) {
    console.error("runAutoOptimize error:", err);
  }
  return actions;
}

export default router;
