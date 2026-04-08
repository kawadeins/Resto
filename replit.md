# RestoSmart — Restaurant Management SaaS

## Overview

RestoSmart is a full-stack SaaS web application providing a premium, information-dense dashboard for restaurant owners. It aims to centralize and optimize various aspects of restaurant management, including staff, inventory, finances, marketing, and customer interactions, to drive growth and operational excellence. Key capabilities include smart staff management, dynamic table availability, comprehensive review management, and advanced analytics. The platform also features a customer-facing marketplace for restaurant discovery, loyalty programs, and smart meal planning. Strategic growth initiatives include sophisticated growth loops, competitive intelligence, AI-driven self-healing operations, and a city expansion engine, with the ambition of market domination.

## User Preferences

- The agent should work iteratively, seeking approval for major changes.
- Provide detailed explanations for complex solutions.
- Focus on high-level features and architectural decisions.
- Do not make changes to files outside the specified `artifacts/` directories unless explicitly instructed.

## System Architecture

**Monorepo Structure:** Managed with `pnpm workspaces`.
**Technology Stack:**
    - **Backend:** Node.js 24, Express 5, PostgreSQL with Drizzle ORM, Zod for validation.
    - **Frontend:** React, Vite, Tailwind CSS, Shadcn/ui, Lucide icons, Recharts.
    - **API Tools:** Orval for API codegen from OpenAPI spec, esbuild for bundling, Wouter for routing.

**Core Features & Design Patterns:**

-   **Owner Dashboard (`artifacts/restosmart`):** Dark theme, professional aesthetic focusing on information density and actionable insights. Includes modules for KPIs, Staff Management, Table Availability, Reviews & Reputation, Inventory, Finances, Analytics, Marketing, POS, Menu, Billing, and Profile. Features a premium system with trial conversion mechanisms, ensuring all displayed data is truthful and not faked.
-   **Customer Marketplace (`artifacts/customer`):** Warm/foodie aesthetic emphasizing discovery and personalization. Modules include Home (flash deals), Explore (listings, map view), Near You Now (hyper-local scoring), Restaurant Detail (booking), My Bookings, Profile Hub, and Meal Plan.
-   **Premium Auto-Conversion Optimization Loop:** An A/B testing framework (`conversion_variants` table) designed to optimize conversion elements (headlines, CTAs) with auto-win logic for high-performing variants and in-app conversion tracking.
-   **Smart Dynamic Pricing System:** Computes real-time boost prices using demand, time, slot, location, and weekend multipliers. Includes AI suggestions for optimal pricing, an auto-optimize mode, and full transparency on multipliers and safety limits.
-   **Boost Wallet System:** Prepaid credit system for running boost campaigns. Table: `wallet_transactions` (type: topup/boost_spend/refund, amount, balance_after). API: `GET /api/wallet`, `POST /api/wallet/topup`, `GET /api/wallet/cost`. `POST /api/promotions` now gates activation behind wallet balance check (returns HTTP 402 if insufficient) and deducts cost on success. Frontend: `WalletPanel` component with top-up UI, transaction history, and low-balance warnings. Balance chip in Promotion Tools header toggles the panel. Base boost costs: breakfast €1.50, lunch/happy_hour €2.00, nightlife €2.50, spotlight/heat €1.80 — scaled by demand multiplier.
-   **Team Management & Access Control:**
    -   **Table:** `team_members` — stores invited team members with email, name, role (owner/manager/staff), status (active/pending/removed), invite_token.
    -   **Owner Bootstrap:** `POST /api/team/bootstrap-owner` — one-time owner email registration, idempotent (blocked if already set).
    -   **Roles:** Owner = full access + billing + team mgmt. Manager = content + boost + analytics + premium control. Staff = view dashboard only.
    -   **Invite Flow:** Owner invites via email → pending status with crypto token → invitee accepts with token → status becomes active.
    -   **Security:** All mutating endpoints (invite, role change, remove, resend) require owner role. Team list requires authenticated team membership. Owner auto-takeover removed (must use explicit bootstrap). Unique index on (email, restaurant_id).
    -   **API Routes:** `/api/team`, `/api/team/invite`, `/api/team/accept`, `/api/team/:id/role` (PATCH), `/api/team/:id` (DELETE), `/api/team/resend`, `/api/team/permissions`, `/api/team/bootstrap-owner`.
    -   **Frontend:** `/team` page with role cards, invite form, member list with action menus, pending/active status indicators.
    -   **Navigation:** "Team" nav item with UsersRound icon between Gehaltsabrechnung and Inventar.
-   **Role-Based UI Locking & Permission Enforcement:**
    -   **Permission Hook:** `usePermissions()` fetches role/permissions from `/api/team/permissions`, provides `role`, `permissions`, `hasPermission()`, `isOwner`, `isManager`, `isStaff`. Frontend defaults to owner/ALL_PERMISSIONS (fail-open for UX); backend remains fail-closed (security boundary). When API returns a valid role+permissions for a team member, the frontend narrows accordingly.
    -   **Route Protection:** `RoleGuard` component wraps protected routes in App.tsx — shows "Kein Zugriff" page (German) with role info when unauthorized.
    -   **Navigation Filtering:** Sidebar and mobile nav hide items the user's role can't access. Staff sees only: Übersicht, Profil, Buchungen, Reservierungen, Tische, Kassenterminal, Bewertungen. Manager adds: Personal, Inventar, Speisekarte, Analyse, Boost, Marketing, Insights, Wachstum, Optimizer. Owner sees everything including Finanzen, Gehaltsabrechnung, Team, Abonnement.
    -   **Server-Side Enforcement:** `requireOwner()` and `requireManagerOrAbove()` middleware on all sensitive API routes: billing (trial/checkout/cancel — owner only); promotions (create/pause/resume/stop/budget); employees (create/update/delete); profile (update); inventory (create/update/delete); sales (create); discounts (flash/scheduled/toggle/delete/blast); menu (create/update/delete/ingredients); shifts (create/delete); campaigns (create/launch); booking-plans (create/update/duplicate/delete); availability (settings/pause); employee-vacations (create/delete); employee-days (toggle/delete); performance (set-rate); onboarding (step/enable-bookings/complete/restaurant).
    -   **Access Denied UI:** Clean German component with shield icon, role label, section name, and link back to overview.
    -   **Key Files:** `hooks/use-permissions.tsx`, `components/access-denied.tsx`, `middleware/role-guard.ts`.
-   **Review Intelligence System (Negative Review Recovery + AI Smart Reply + Impact Tracking):**
    -   **DB columns added:** `recovery_status` (null|pending|resolved|published|closed), `recovery_message`, `business_response`, `business_responded_at`, `ai_reply_suggestion`, `initial_rating`, `ai_used` (boolean), `response_time_hours` (numeric).
    -   **Customer Flow:** Low-rating reviews (≤3 stars) are intercepted and show a choice dialog: "Problem klären" (sets `recovery_status=pending`, hidden from public) or "Trotzdem veröffentlichen" (publishes immediately). After the business responds (`resolved`), the customer can publish (optionally edit rating), or close the issue. A 20-second polling loop shows "Der Betrieb hat geantwortet" notification.
    -   **Owner Dashboard — Kritisches Feedback:** Section in `/reviews` page showing all pending recovery cases. Each case shows the customer's message, star rating, and two action buttons.
    -   **AI Smart Reply (Premium-only):** Button "KI-Antwort" calls `POST /api/reviews/:id/ai-suggest` → GPT-4o-mini generates a professional German reply (empathetic, solution-oriented). Sets `ai_used=true` in DB. Non-premium users see locked button + "Premium erforderlich" + "Upgrade auf Premium" inline CTA.
    -   **Manual Reply (Free):** "Manuell antworten" button lets free users compose their own response. All users can reply manually.
    -   **Impact Tracking:** `initial_rating` stored on recovery creation. `response_time_hours` computed on `POST /api/reviews/:id/business-response`. Rating improvement tracked on publish.
    -   **Feedback-Analyse (Premium analytics):** Card below Kritisches Feedback section. Shows: % resolved cases, Ø Verbesserung (avg rating improvement), Ø Antwortzeit, KI-Erfolgsrate. Non-premium sees locked lock icon + upgrade prompt. Uses `recovery` object in insights API.
    -   **Analytics API:** `GET /api/reviews/insights` returns `recovery: { totalCases, resolvedRate, avgRatingImprovement, avgResponseTimeHours, aiUsageRate, aiSuccessRate }`.
    -   **AI Model:** GPT-4o-mini via Replit AI Integrations (`@workspace/integrations-openai-ai-server`). Note: gpt-5 uses reasoning tokens and returns empty content — use gpt-4o-mini.
    -   **Fairness rules:** Reviews are never deleted or permanently hidden; "pending" is a temporary state. Users can always "Trotzdem veröffentlichen". No manipulation of ratings.
-   **Business Self-Serve Growth Loop:** Dedicated `/for-business` landing page for instant trial activation and an in-dashboard Growth Activation Hub with checklists and value signals for trial users.
-   **Business Competition Engine:** Provides owners with competitive insights via dashboard widgets (Visibility Strength, Demand/Competition Signal) and a founder panel for deeper analysis.
-   **AI Self-Healing Ops Layer v2 + Founder Alert System:** An `ops_incidents` database tracks and auto-heals incidents across various categories (billing, boost delivery, platform consistency). Features an auto-retry engine and billing reconciliation. The Founder Interface ("Mission Control") provides a comprehensive overview of system health, incident management, and audit trails.
-   **Master Brain + Auto Decision Engine v2:** A central intelligence system (`brain.ts`) that monitors 26 core systems, assesses their health, speed, and risk levels, and generates priority scores. Features a link verification layer, a Brain Mode Engine (monitoring, decision_support, safe_autonomous), and an Auto-Execution Engine that performs safe auto-actions. It also includes a risk classification layer for systems and priorities, providing a launch verdict (ready/ready_with_risks/not_ready).
-   **City Expansion Engine:** Provides health scores for cities based on business metrics, offering insights for expansion decisions to both owners and founders.
-   **Behavior Priority Engine (Ranking Brain + Sponsored Boost System):** A client-side ranking system for discovery surfaces based on relevance and boost scores, with transparent `isSponsored` indicators and daily budget tracking for promotions.
-   **Auto Revenue Optimization Engine (`/optimizer`):** Analyzes promotion data to generate business-type-aware recommendations and provides a dashboard with KPIs, ROI feedback, and strategy tips.
-   **Dynamic Pricing Engine:** Computes real-time impression costs based on various factors, with owner-facing panels and founder configuration controls, ensuring transparency of cost breakdowns.

**Authentication:**
-   **Super-admin:** `X-Super-Admin-Key` header.
-   **Founder:** `x-founder-key` header, localStorage `restosmart_founder_key`.
-   **Customer:** localStorage email (`restosmart_email`).
-   **Owner Premium:** localStorage flag (`restosmart_owner_premium`).

-   **Real Stripe Billing System (Production-Ready):**
    -   **Stripe Integration:** Connected via Replit Stripe connector. Packages: `stripe@20.0.0` + `stripe-replit-sync@1.0.0` at workspace root.
    -   **Products created in Stripe:** "RestoSmart Business Premium" (€39.90/month recurring EUR) and "RestoSmart Wallet Topup" (one-time prices: €5, €10, €20, €50 EUR).
    -   **Checkout flow:** `POST /api/billing/checkout` → creates real Stripe Checkout Session → returns `{url}` → frontend redirects. Premium is NOT activated by this route — only by webhook.
    -   **Wallet topup flow:** `POST /api/wallet/topup` → creates real Stripe Checkout Session (one-time payment) → returns `{checkoutUrl}` → frontend redirects. Wallet credit is ONLY added after `checkout.session.completed` webhook with `payment_status=paid`.
    -   **Webhook:** Registered at `POST /api/stripe/webhook` with `express.raw()` BEFORE `express.json()`. Handled in `webhookHandlers.ts` using `stripe-replit-sync` for signature verification + custom business logic.
    -   **Events handled:** `checkout.session.completed` (subscription + wallet topup), `invoice.paid` (renewal), `invoice.payment_failed` (past_due), `customer.subscription.updated/deleted` (state sync), `payment_intent.succeeded/failed` (logged).
    -   **Idempotency:** `stripe_webhook_events` table prevents duplicate processing. Events are checked before processing.
    -   **Stripe schema:** `stripe-replit-sync` manages 29 tables in `stripe` schema (products, prices, customers, subscriptions, etc.). Synced via `runMigrations()` + `syncBackfill()` on startup.
    -   **Stripe init:** `initStripe()` in `index.ts` runs on startup: `runMigrations()` → `getStripeSync()` → `findOrCreateManagedWebhook()` → `syncBackfill()` (non-blocking).
    -   **Cancel:** `POST /api/billing/cancel` cancels in Stripe (if subscription ID exists) + updates DB. Also accessible via Stripe Customer Portal.
    -   **Portal:** `GET /api/billing/portal` creates Stripe Billing Portal session for managing payment method, invoices, and subscriptions.
    -   **Return URLs:** Success → `/restosmart/billing?stripe=success`, Cancel → `/restosmart/billing?stripe=cancel`. Wallet: `?topup=success/cancel`. Billing page polls DB status after return.
    -   **Frontend:** billing.tsx shows real-time status banners (payment pending, activated, cancelled, past_due). All checkout buttons redirect to Stripe. "Zahlungsdetails & Rechnungen verwalten" links to Stripe Portal.
    -   **Seed script:** `pnpm --filter @workspace/scripts run seed-products` creates Stripe products/prices.
    -   **Key files:** `artifacts/api-server/src/stripeClient.ts`, `webhookHandlers.ts`, `routes/billing.ts`, `routes/wallet.ts`, `scripts/src/seed-products.ts`.

**Architectural Limitations (by design):** Single-tenant (hardcoded restaurant ID 1), no real multi-tenant auth, email delivery disabled by default without `RESEND_API_KEY`.

## External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Email Service:** Resend (requires `RESEND_API_KEY` for activation)
-   **UI Components:** Radix UI (via Shadcn/ui), Lucide icons
-   **Charting:** Recharts
-   **Mapping:** Leaflet/OpenStreetMap
-   **Payment Gateway:** Mock Stripe (no real payment integration)