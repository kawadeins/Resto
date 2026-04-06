# RestoSmart — Restaurant Management SaaS

## Overview

RestoSmart is a full-stack SaaS web application designed as a premium restaurant management dashboard. It provides restaurant owners with a professional, information-dense operating system to manage their operations efficiently. The platform aims to centralize various aspects of restaurant management, including staff, inventory, finances, marketing, and customer interactions, to drive growth and operational excellence. Key capabilities include smart staff management, dynamic table availability, comprehensive review management, and advanced analytics. The customer-facing marketplace offers features like hyper-local restaurant discovery, loyalty programs, and a smart weekly meal planner. The project also incorporates sophisticated growth loops, competitive intelligence, AI-driven self-healing operations, and a strategic city expansion engine to foster market domination.

## User Preferences

- The agent should work iteratively, seeking approval for major changes.
- Provide detailed explanations for complex solutions.
- Focus on high-level features and architectural decisions.
- Do not make changes to files outside the specified `artifacts/` directories unless explicitly instructed.

## System Architecture

**Monorepo Structure:** Managed with `pnpm workspaces`.
**Technology Stack:**
    - **Backend:** Node.js 24, Express 5, PostgreSQL with Drizzle ORM, Zod for validation.
    - **Frontend:** React, Vite, Tailwind CSS (dark theme for admin, warm/foodie for customer), Shadcn/ui, Lucide icons, Recharts.
    - **API Tools:** Orval for API codegen from OpenAPI spec, esbuild for bundling, Wouter for routing.

**Core Features & Design Patterns:**

-   **Owner Dashboard (`artifacts/restosmart`):**
    -   **UI/UX:** Dark theme, Inter font, professional aesthetic.
    -   **Modules:** Overview KPIs, Staff Management (CRUD, rota, smart reminders, performance/payroll), Table Availability (slot heatmap, pause controls), Reviews & Reputation (4-tab filter, review request sender, rating sync), Inventory, Finances, Analytics (trial users get full access + TrialConversionBanner), Sichtbarkeit & Boost (/boost — dedicated boost/promotion page with business-type-aware filtering), Marketing/Campaigns, Dead Hours/Growth Hub, POS (local-timezone date filtering), Menu, Billing (real stats from /api/promotions/my, Echtdaten badge), Profile (Vienna/AT placeholders).
    -   **Premium System:** `restosmart_owner_premium` = "active"|"trial"|null. Trial users see full analytics. Expired trial shows real promotion stats (not fake numbers). `/boost` route with Flame icon in nav between Analyse and Marketing. All upgrade CTAs are in-app (localStorage + reload), zero external redirects.
    -   **Data Truthfulness:** All fake/demo data removed. GrowthActivationHub shows honest status signals (not random numbers). Wien-Nachfrage uses real API data with dash fallback. Revenue estimates labeled honestly. POS uses local-timezone date filtering. Analytics label says "Echtdaten aus Ihrem Betrieb".
    -   **Design:** Focus on information density and actionable insights.
-   **Customer Marketplace (`artifacts/customer`):**
    -   **UI/UX:** Warm/foodie aesthetic.
    -   **Modules:** Home (flash deals), Explore (listings, map view), Near You Now (hyper-local scoring, availability chips), Restaurant Detail (booking form, color-coded availability), My Bookings (reviews, loyalty points), Profile Hub (account management, avatar upload, privacy/security), Meal Plan (personal/group planning, smart matches), Owner Premium Card/Flow.
    -   **Design:** Engaging, user-friendly interface with emphasis on discovery and personalization.
-   **Premium Auto-Conversion Optimization Loop:**
    -   **Architecture:** A/B testing framework (`conversion_variants` table with `rollout_pct` + `rollout_stage_impressions` columns, dedicated API endpoints) to optimize conversion elements (headlines, CTAs, proof points).
    -   **Logic:** Auto-win logic for variants with significant performance leads (impressions ≥ 40, CTR ≥ 20% higher than runner-up). Winners start at 70% rollout, escalating +10% after every 20 new impressions until 100%.
    -   **Conversion Tracking:** All trial start and paid upgrade CTAs track `isConversion=true` via `trackVariantClick()`. 38 active variants across 7 element types; 5 fake proof_focus variants retired; Variant D high-impact copy seeded.
-   **Business Self-Serve Growth Loop:**
    -   **Entry Point:** Dedicated `/for-business` landing page in customer app, footer CTA.
    -   **Activation Flow:** Instant trial activation for self-serve sign-ups, eliminating 24h wait.
    -   **Growth Activation Hub:** In-dashboard checklist for trial users, value signals, trial countdown.
-   **Business Competition Engine:**
    -   **Owner-Facing:** Widget in overview dashboard (Visibility Strength, Demand/Competition Signal, Slot Availability) with urgent CTAs.
    -   **Founder-Facing:** Founder panel tab for competitive insights and boost history.
-   **AI Self-Healing Ops Layer v2 + Founder Alert System:**
    -   **Database:** `ops_incidents` table with healing fields: retry_count, max_retries (default 3), auto_healed, healing_action_type, last_retry_at.
    -   **Health Checks:** 6 categories (premium/billing sync, boost delivery+auto-heal, billing reconciliation+auto-heal, platform consistency, claims abuse, revenue anomalies).
    -   **Self-Healing Actions (5 types):** counter_reset, pause_boosts_inactive_restaurant, pause_overspend_campaign, rating_clamp, info_only.
    -   **Auto-Retry Engine:** Retries retryable open incidents up to max_retries, escalates on exhaustion.
    -   **Billing Reconciliation:** Compares payment truth vs platform truth, auto-repairs safe mismatches.
    -   **Scheduled Checks:** Background health checks every 10 minutes (automatic, no manual trigger needed).
    -   **API:** POST health-check, billing-reconcile, retry-open; GET incidents (with category filters: auto_healed, needs_review, billing), summary (with healing stats), audit-trail; PATCH incidents/:id.
    -   **Founder Interface (Mission Control):** Hardened Ops tab with health bar (pulse indicator, Gesund/Warnung/Beeinträchtigt/Kritisch), smart natural-language summary block, "Sofortige Aufmerksamkeit" top-priority panel, incident grouping by category (Billing/Boost/Plattform/Missbrauch/Wachstum) with severity distribution, revenue impact tags ("Umsatz") on money-related incidents, auto-fix visibility section (Auto-Repariert/Review nötig/Eskaliert), incident timeline view, signal-vs-noise control (collapsible low-priority), action-focused incident cards with "Was ist passiert / Warum es wichtig ist / System-Reaktion" columns, 8 filter tabs (Aufmerksamkeit/Review/Auto-Repariert/Billing/Offen/Eskaliert/Alle/Gelöst), quick action controls (resolve/escalate/dismiss).
    -   **Safety:** No destructive auto-actions, honest failure reporting, full audit trail, deduplicated incidents.
-   **Master Brain + Auto Decision Engine v2:**
    -   **Backend (`brain.ts`):** 26 system health checks with full ops_incidents binding. Systems: premium, billing, boost, growth, competition, watchdog, cities, social, instant_plans, reviews, data_integrity, abuse, monetization, discovery, map, smart_offers, user_profiles, reservations, loyalty, conversion, notifications, launch_control, heat_map, auto_plans, auth (static), founder_dashboard (static). Each produces health (green/yellow/red), speed, error/risk levels, metrics, incidents, analysis, connectionStatus, connectionDetails (5-point verification), and recommendedAction.
    -   **Link Verification Layer:** Every system has 5-point connection check (sendsStatus, sendsIncidents, sendsPerformance, sendsRiskSignals, returnsHealth). 25/26 systems fully connected (5/5); auth intentionally 2/5 (static system).
    -   **Brain Mode Engine:** monitoring (readiness<50%), decision_support (readiness 50-70%), safe_autonomous (readiness≥70% + all critical systems healthy). Currently operating in safe_autonomous at 96% readiness.
    -   **Priority Scoring Algorithm:** Weighs health state, error/risk levels, incident counts, connection status, and importance weight (critical/high/medium/low). Produces ranked priorities with suggested actions and safe auto-actions.
    -   **Auto-Execution Engine:** In safe_autonomous mode, automatically executes top-3 safe actions (retry-open, health-check, billing-reconcile) via ops API. In-memory action log (max 100 entries).
    -   **Risk Classification Layer:** Every system and priority gets classified into 5 tiers: demo_test (expected in non-production), non_production (cannot validate without real traffic), minor_operational (self-healing or low-impact), production_risk (dangerous under real usage), launch_blocker (must fix before go-live). Each classification includes a German-language explanation of WHY. Auth is always launch_blocker. Boost without traffic is non_production. Billing without real payments is demo_test. Classification counts and launch verdict (ready/ready_with_risks/not_ready) returned in API response.
    -   **API:** GET `/api/brain/status` (26 systems, priorities, topPriorities, brainMode, readinessPercent, connectionCounts, classificationCounts, launchVerdict, summaryLines, autoActionsThisRun, autoActionHistory); POST `/api/brain/action/:actionType`.
    -   **Founder Interface ("Master Brain" tab):** Header with health badge + mode badge + readiness %, summary lines block (now shows real risks vs demo alerts), 8-stat grid, launch verdict banner (Startbereit/Bedingt startbereit/Nicht startbereit) with classification filter buttons (Demo/Non-Prod/Minor/Risiko/Blocker), brain mode warning banner, 3 section tabs. Overview: scrollable system card grid with classification badge per system + detail panel (classification box with reason, connection verification, metrics, incidents). Intelligence Feed: critical items with classification badges + reasons, auto-fixed items, manual review queue. Actions: auto-actions this run, history log, 3 manual trigger buttons. Expandable priority cards with classification explanation box + 3-column detail view.
    -   **Auto Actions:** Safe auto-fix buttons on priorities where `safeAutoAction` is set; triggers ops actions and refreshes all related queries.
-   **City Expansion Engine:**
    -   **City Data:** Health scores based on `bizCount`, `premiumCount`, `activeBoosts`, `avgRating`, `bookingPlans`.
    -   **Owner-Facing:** Widget with city health score, demand/competition/opportunity signals.
    -   **Founder-Facing:** "Städte" tab with city cards, expansion decision matrix.
-   **Behavior Priority Engine (Ranking Brain + Sponsored Boost System):**
    -   **Client-side Ranking (`ranking-engine.ts`):** Unified ranking system for all discovery surfaces based on `finalScore = relevanceScore * (closedMultiplier * distanceMultiplier) + boostScore`.
    -   **Transparency:** `isSponsored` flag and "Gesponsert" chip for paid placements.
    -   **Budget System:** Daily budget tracking for promotions, impression-based deductions.
    -   **Compliance:** Fixes for fake labels and explicit sponsored disclosures.
-   **Auto Revenue Optimization Engine (`/optimizer`):**
    -   **Backend:** Analyzes promotion data, generates business-type-aware recommendations (`missing_boost`, `boost_time_window`, etc.).
    -   **Frontend:** Dashboard page (`/optimizer`) with KPIs, smart recommendations, ROI feedback, peak hours, and strategy tips.
-   **Dynamic Pricing Engine:**
    -   **Backend:** Real-time impression cost computation (`pricing-engine.ts`) based on base price, demand, time, competition, and weekend multipliers. Configuration stored in `platform_config`.
    -   **Frontend:** DynamicPricingPanel in promotion tools for owners, FounderPricingControls for configuration.
    -   **Transparency:** All multipliers and cost breakdowns are visible.

**Authentication:**
-   **Super-admin:** `X-Super-Admin-Key` header.
-   **Founder:** `x-founder-key` header, localStorage `restosmart_founder_key`.
-   **Customer:** localStorage email (`restosmart_email`).
-   **Owner Premium:** localStorage flag (`restosmart_owner_premium`).

**API URL Pattern:** All frontend `fetch` calls *must* use `API_BASE` (empty string) to correctly route through the Replit proxy.
**File Uploads:** Handled by API server, normalizing paths from `/uploads/` to `/api/uploads/`.
**Architectural Limitations (by design):** Single-tenant (hardcoded restaurant ID 1), no real multi-tenant auth, mock payments, email delivery disabled by default without `RESEND_API_KEY`.

## External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Email Service:** Resend (requires `RESEND_API_KEY` for activation)
-   **UI Components:** Radix UI (via Shadcn/ui), Lucide icons
-   **Charting:** Recharts
-   **Mapping:** Leaflet/OpenStreetMap
-   **Payment Gateway:** Mock Stripe (no real payment integration)