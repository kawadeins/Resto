# RestoSmart — Restaurant Management SaaS

## Overview

RestoSmart is a premium restaurant management dashboard built as a full-stack SaaS web app. It targets restaurant owners who need a professional, information-dense operating system for managing their restaurant.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (dark theme for admin, warm/foodie for customer)
- **UI Components**: Shadcn/ui (Radix UI), Lucide icons, Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild
- **Routing**: Wouter

## Artifacts

- **`artifacts/restosmart`** — Owner dashboard (dark theme, Inter font, no emojis)
- **`artifacts/customer`** — Customer marketplace (warm/foodie aesthetic)
- **`artifacts/api-server`** — Express 5 backend API

## Key Database Tables

- `employees` — id, name, role, email, phone, status, hourly_rate
- `shifts` — id, employee_id (FK), day_of_week, start_time, end_time
- `shift_attendance` — per-shift daily attendance records (status: pending/confirmed/late/missed, reminder timestamps)
- `reservations` — customer bookings with review_request_sent_at column
- `reviews` — customer reviews with rating, comment, owner reply
- `restaurants` — single restaurant with availability columns (table_capacity, seating_capacity, slot_duration_minutes, max_party_size, walk_ins_enabled, availability_paused, availability_paused_until)
- `notification_logs` — all email/notification audit trail
- `discounts`, `pos_sales`, `inventory`, `campaigns`, `loyalty_points` — core operations

## Features

### Owner Dashboard (`artifacts/restosmart`)

1. **Overview Dashboard** — KPI stats, revenue chart, notifications
2. **Staff Management** — Employee CRUD, weekly rota grid
3. **Smart Staff Reminder & Attendance System** — Morning/pre-shift email reminders via Resend, attendance confirmation via token links, attendance status (confirmed/late/missed), daily tracking
4. **Staff Performance & Payroll** (`/payroll`) — Hourly rate per employee (editable), projected vs actual monthly pay, attendance rate, reliability leaderboard
5. **Table Availability & Walk-In Engine** (`/tables`) — Slot heatmap, weekly pattern, pause controls, capacity settings
6. **Reviews & Reputation** (`/reviews`) — 4-tab filter (All/Needs Attention/Unreplied/Positive), insights KPIs, review request sender, rating sync, reply with urgent CTA for low-rated reviews
7. **Inventory** — Stock management with low-stock alerts
8. **Finances** — Revenue/profit analytics
9. **Analytics** — Performance charts
10. **Marketing / Campaigns** — Campaign management
11. **Dead Hours / Growth Hub** — Insight suggestions and growth tools
12. **POS**, **Menu**, **Billing** — Operations management

### Customer Marketplace (`artifacts/customer`)

1. **Home** — Hero section with flash deals carousel
2. **Explore** — Restaurant listings with map view
3. **Near You Now** — Hyper-local scoring with availability chips (Tables available / Limited / Almost full / Next slot)
4. **Restaurant Detail** (`/restaurant/:id`) — Booking form with color-coded slot availability per date
5. **Map View** — Leaflet/OpenStreetMap with availability popup chips
6. **My Bookings** — Past reservations with inline "Leave a Review" form (star picker + comment, auto-awards 5 loyalty points)
7. **Loyalty Points** — Tier tracking (Bronze/Silver/Gold)
8. **Profile Hub** — Full account management with 4 tabs (Übersicht, Geschmack, Aktivität, Einstellungen), inline avatar upload, editable fields
9. **Owner Premium Card** — Prominent card at top of profile; sales card for non-premium users (shows 9 features, pricing, 30-day free trial); becomes a direct dashboard gateway after activation. Activation state stored in localStorage (`restosmart_owner_premium`, `restosmart_owner_email`).
10. **Premium Flow** — 3-step modal: (1) plan presentation with feature grid + pricing, (2) simulated payment form (card number/name/expiry/CVC), (3) success screen with dashboard redirect to `/` (owner admin app)
11. **Privacy & Security Section** — In Settings tab: data transparency card, notification toggle switches, active sessions list, data export, account deletion with confirmation flow
12. **Mahlzeitenplan (Meal Plan)** (`/meal-plan`) — Smart weekly meal planner with personal + group dining modes:
    - **Personal Plan**: 7-day tab selector (today highlighted), two slots per day (Mittagessen ☀️ / Abendessen 🌙), food type bubble grid (12 categories: Burger, Pizza, Fleisch, Fisch, Pasta, Sushi, Vegan, Desserts, Salat, Mexikanisch, Asiatisch, Orientalisch), weekly overview strip showing planned meals at a glance
    - **Smart Matches**: "Heutige Matches" section auto-surfaces nearby restaurants that match today's planned food type using rule-based cuisine keyword scoring; shows open/closed status, flash deals, ratings
    - **Group Plan Mode**: Full creation flow with title, date/time, meal slot, food theme bubble picker, participant list (name + phone), reminder timing (1 hour / 1 day / both); per-plan restaurant suggestions; organized into upcoming/past sections
    - DB: `meal_plans` (unique per email+day+slot), `group_plans` (participants stored as JSON)
    - API: `GET/PUT/DELETE /api/meal-plan/:email`, `GET /api/meal-plan/:email/suggestions`, `POST /api/meal-plan/group`, `GET /api/meal-plan/group/:email`, `GET/DELETE /api/meal-plan/group/:id/suggestions`

## Wien Market Focus (Growth Activation)

### City Data (30 Wien venues — City Domination Update)
- **IDs 1–6**: Original venues migrated to Wien (Stephansplatz, Mariahilfer Str., Naschmarkt, Rotenturmstraße, Schottenring, Neubau)
- **IDs 7–12**: First batch — Café Prater, Kaffeepause Josefstadt, Rote Bar Wien, Heuriger Grinzing, Grünwald Bistro, Mochi Ramen Wien
- **IDs 13–30**: City Domination batch — 18 new venues across 1st (Innere Stadt), 2nd (Leopoldstadt), 3rd (Landstraße), 4th (Wieden), 6th (Mariahilf), 7th (Neubau), 8th (Josefstadt), 9th (Alsergrund), 15th (Rudolfsheim)
- All 30 venues tagged with district tags (innerestadt, leopoldstadt, neubau, alsergrund, rudolfsheim, mariahilf, etc.)
- Map default center fixed: 48.2093, 16.3726 (Wien Innere Stadt) — was London (bug fix)

### City Domination Features
- **Wien Bezirke quick-nav** on homepage (between Business Type and CTA) — 5 districts → explore/?search=tag
- **Wien Bezirke chips** in explore sidebar — instant district filter that toggles search state
- **"Trending in Wien"** section on homepage — always shows top 3 rated restaurants, no geo required
- **Explore header** updated: "Wien entdecken" + "30 Lokale · Restaurants, Cafés & Bars"
- **Results count** localized: "X Lokale in Wien gefunden"

### Hero Copy (Zeit-sensitiv, Wien-fokussiert)
- `HEADLINE_MAP` in `home.tsx`: "Was geht heute Abend in Wien?", "Guten Morgen Wien — Ihr Kaffee wartet.", etc.
- All sublines in `use-lifestyle-mode.ts` now mention Wien; fixed "London" bug in night mode
- SEO title: "RestoSmart Wien — Restaurants, Cafés & Bars entdecken"

### Hero Fallback Fix
- No-deal fallback replaced: "Keine Blitzangebote" → "Beliebt in Wien" card showing top-rated restaurant (always has content)

### Cuisine Lists (Wien-lokalisiert)
- "Britisch" 🫖 → "Österreichisch" 🥩 in `home.tsx`, `explore.tsx`
- "Thailändisch" → "Vegetarisch" in `home.tsx`
- Smart-offers mapping extended with Austrian/Ramen to Japanese

### Light Onboarding Vibe Picker
- `artifacts/customer/src/components/vibe-onboarding.tsx` — first-visit modal, appears after 1.5s
- 3 vibes: Café & Kaffee ☕ / Essen gehen 🍽️ / Bar & Nightlife 🍸
- Stored in localStorage `restosmart_vibe`; done flag in `restosmart_vibe_done`
- No blocker — user can skip; redirects to `/explore?businessType=...` on selection

### Business Demand Signal Card (Owner Dashboard)
- Wien-Nachfrage card in `overview.tsx` — shows bookings this week, impressions, venue count
- CTA: "Boost aktivieren" → campaigns, "Statistiken" → insights
- Uses real `localReach` and `summary` data already fetched on the overview page

## Growth Loop & Habit Engine (Customer)

### Habit Events (wired to real actions in `restaurant.tsx`)
- `explore_visit` — fires on restaurant detail page load (useEffect)
- `booking_complete` — fires on successful booking API response
- `review_submit` — fires on successful review API response
- Engine: `artifacts/customer/src/lib/habit-engine.ts`; data stored in localStorage `restosmart_habit_data`

### Booking Success State
- Toast shows loyalty points hint ("Punkte werden nach Ihrem Besuch gutgeschrieben")
- Full success state renders a reward panel (amber ⭐ callout) + dual CTAs: "Meine Buchungen" + "Nochmal buchen"
- Loyalty points are only awarded when owner marks guest as "arrived" — NOT at booking time (honest)

### Smart Offers Section ("Für Sie ausgewählt")
- `artifacts/customer/src/components/smart-offers-section.tsx`
- Always shows ranked restaurants (score > 0) even with zero personalization (rating + availability always produce a score)
- Each card has an explicit CTA: "Jetzt buchen" (flash deal) / "Details ansehen" (regular) + limited availability chip

### Honest Social Signals (No Fake Urgency)
- Group Suggestions section header: no live-pulse indicator; subtitle: "Basierend auf Freundesaktivitäten der letzten 6 Stunden"
- Group suggestion urgency: `high → medium`, `medium → low` in `artifacts/api-server/src/routes/social.ts` — no misleading pulse animations
- "Freunde sind hier" badge → "Freunde zuletzt aktiv" in `artifacts/customer/src/lib/live-activity.ts`
- "Auto Plan" / ping animation → "Vorschlag für heute" + Zap icon in `auto-plan-card.tsx`

## Availability System

- Statuses: `available` | `limited` | `nearly_full` | `full` | `closed` | `paused`
- Hyper-local score: `(1/(dist+0.1))*4 + openNow*3 + hasDeal*2 + (rating/5)*1.5 + weakHour*1.5 + availScore`
- availScore: available→+2, limited→+1
- Admin can pause availability with expiry time

## API Routes (key new routes)

- `GET /api/availability/settings` — Capacity and slot settings
- `PUT /api/availability/settings` — Update settings
- `POST /api/availability/pause` — Pause/resume availability
- `GET /api/availability/overview` — Slot heatmap and weekly pattern
- `GET /api/marketplace/slots` — Color-coded slot availability for a date
- `GET /api/reviews/insights` — Rich analytics (trend, reply rate, needs attention)
- `GET /api/reviews/pending-requests` — Completed visits without review requests
- `POST /api/reviews/send-request` — Send review request email
- `POST /api/reviews/rating-sync` — Sync avg rating back to restaurant record
- `GET /api/performance/summary` — Employee payroll and attendance metrics
- `GET /api/performance/leaderboard` — Reliability leaderboard
- `POST /api/performance/set-rate` — Update employee hourly rate

## Founder Command Center

- **Route**: `/founder` in the admin (restosmart) app — bypasses PremiumGate entirely, has its own gate
- **Auth**: Founder key stored in localStorage (`restosmart_founder_key`); default key: `rs_founder_2026`; server validates via `x-founder-key` header against env var `FOUNDER_KEY` (default: `rs_founder_2026`)
- **API**: `GET /api/founder/metrics` (aggregated KPIs, rankings, alerts, breakdowns) + `GET /api/founder/businesses` (enriched business list)
- **Dashboard sections**: Executive KPI strip (MRR, premium, churn, boosts, conversions), exec alerts, business type breakdown, city leaderboard, boost performance by type (with CTR + ROI), 4-column rankings (top boosted, top spenders, upsell candidates, churn risk), full business directory with inline founder notes/tags/flags stored in localStorage
- **Data**: All computed from `restaurants`, `promotions`, `promotion_events` tables; reservation totals from `reservations` (no restaurant_id on that table, so per-restaurant booking count uses boost bookings as proxy)

## Auth

- Super-admin: `X-Super-Admin-Key` header, env var `SUPER_ADMIN_KEY` (default: `restosmart-super-2025`)
- Founder: `x-founder-key` header, env var `FOUNDER_KEY` (default: `rs_founder_2026`); localStorage key `restosmart_founder_key`
- Customer: email-based identity stored in localStorage (`restosmart_email`)
- Owner Premium: localStorage (`restosmart_owner_premium` = `"active"`, `restosmart_owner_email` = the email that activated)
- Geo: sessionStorage (`restosmart_geolocation`)

## Email

- Resend library, `FROM_EMAIL` env var, logs to notification_logs, never throws
- Generic `sendEmail()` helper in `artifacts/api-server/src/lib/email.ts`

## API URL Pattern (CRITICAL)

All `fetch` calls in `artifacts/customer/src` **must** use:
```ts
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
// Then: fetch(`${API_BASE}/api/some-route`)
```
`VITE_API_URL` is intentionally `""` (empty). The Replit proxy routes `/api/...` → the API server automatically.
**Never** use path manipulation fallbacks like `BASE_URL.replace(...)` — they produce broken URLs like `/customer/api-server/api/...`.

## File Uploads

- API server serves uploads at both `/uploads/:file` (direct) and `/api/uploads/:file` (proxy-accessible)
- `artifacts/api-server/src/routes/marketplace.ts` normalises all `heroImage`/`photos` paths from `/uploads/` → `/api/uploads/` so images load through the Replit proxy

## Known Architectural Limitations (by design for now)

- **Single-tenant**: restosmart dashboard always serves restaurant ID 1; billing, pilot, reviews, platform all hardcoded to restaurantId=1. Multi-tenancy requires a full auth/session overhaul.
- **No real auth**: customer identity = localStorage email; business auth = localStorage premium flag; payment = mock Stripe session (no real checkout).
- **Email disabled by default**: All emails silently skipped if `RESEND_API_KEY` env var not set. Set it in Replit Secrets to enable real delivery. The `/api/campaigns/status` endpoint exposes `{ emailEnabled: bool }` and the Campaigns page shows a warning banner when disabled.
- **Flash deals are platform-wide**: `discounts` table has no `restaurant_id` column; one flash deal at a time applies globally across all restaurants.

## Bug Fixes Applied (Phase 1 + Phase 2 Audit)

- **B-1 Fixed**: `overview.ts` — removed random `|| Math.floor(Math.random() * 8) + 5` fallback from `tableOccupancy`; now returns real count (0 when no reservations).
- **A-4 Fixed**: `restosmart/login.tsx` — replaced dead `window.location.replace("/customer/profile")` with proper in-app `useLocation` redirect to `/`.
- **B-4 Fixed**: `meal-plan.ts` — `hasFlash = activeDeal && r.id === 1` replaced with proper expiry check.
- **B-3 Fixed**: `meal-plan.ts` — added bare `GET /api/meal-plan` 400 guard (was 404).
- **B-2 Fixed**: `marketplace.ts` — restaurants with active boosts now sort first in the `/restaurants` list (boosted → then by rating).
- **B-5 Fixed**: Added `GET /api/campaigns/status` endpoint exposing `{ emailEnabled: bool }`.
- **B-6 Fixed**: Campaigns page shows orange warning banner when email is not configured.
- **B-7 Fixed**: Added `POST /api/promotions/restaurant/:restaurantId/impression` convenience endpoint; explore page fires impression events (once per session per restaurant) for boosted restaurants that appear in the list.

## Critical Honesty Fixes (Phase 3 — Security / Ethics Audit)

- **A-3 Fixed (CRITICAL)**: `customer/profile.tsx` — Removed the entire fake payment form from `PremiumModal`. The old step 1 collected real card numbers, showed fake "256-bit SSL" + "PCI DSS konform" trust badges, detected Apple Pay / Google Pay via browser APIs, then silently discarded all card data after a 2-second fake animation. Replaced with an honest "Demo-Modus" activation screen that clearly states no payment is required.
- **A-2 Fixed**: `customer/profile.tsx` — Social login buttons ("Mit Apple fortfahren" / "Mit Google fortfahren") relabeled to "Als Apple-Gerät fortfahren (Demo)" / "Als Google-Konto fortfahren (Demo)" to make the demo-identity nature explicit.
- **A-2a Fixed**: `customer/profile.tsx` — Login screen trust strip removed false "Ende-zu-Ende" (E2E encryption) and "DSGVO" (GDPR) claims. Replaced with honest "Gerätebezogene Demo-ID" label.
- **A-3a Fixed**: `customer/profile.tsx` — `handleGoToDashboard()` redirect fixed from `window.location.origin + "/"` (customer homepage) to `window.location.origin + "/restosmart/"` (actual restosmart dashboard). Same fix applied to `OwnerPremiumCard` and the settings panel dashboard link (both previously redirected to `"/"`).
- **B-8 Fixed**: `digital-twin.ts` — `getTwinInsightLabel` no longer uses `Math.random()` for label selection; uses deterministic index based on `bizAff` value (stable per-user, no UI flickering).

## Product Polish Pass (Phase 4)

- **P-1 Fixed**: `restaurant-card.tsx` — Removed redundant "Aktiv" badge (green chip that duplicated the "Geöffnet" status badge already on the image). Only truly meaningful live signals (Trending, Hot, Lunch-Rush, Happy Hour, etc.) now appear.
- **P-2 Fixed**: `restaurant-card.tsx` — Removed `|| true` bug on line 195 that forced the live badge / social cue row to always render even when both were empty, adding invisible whitespace.
- **P-3 Added**: `restaurant-card.tsx` — Added compact "Ansehen →" CTA in the tag row of each card for clearer click affordance.
- **P-4 Fixed**: `restaurant-card.tsx` — Tags reduced from showing 2 + overflow to 1 + compact overflow count for less visual noise.
- **P-5 Fixed**: `restaurant-card.tsx`, `restaurant.tsx`, `home.tsx` — Added `CUISINE_DE` translation map; cuisine labels now display in German ("Italienisch" not "Italian", "Französisch" not "French", etc.) everywhere in the customer UI (cards, detail page, hero flash deal card).
- **P-6 Added**: `home.tsx` — Added "Restaurants" quick-filter button to the hero alongside "Cafés" and "Bars" so all 3 business types are represented.
- **P-7 Fixed**: `home.tsx` — Improved the empty-state message in dynamic sections from plain "Derzeit keine Einträge gefunden." to a friendly emoji + two-line German message.
- **P-8 Fixed**: `restaurant.tsx` — Opening days now rendered in German with smart range compression ("Täglich" for all 7 days, "Mo–Fr" for weekday ranges, etc.) instead of raw English day names from the DB.
- **P-9 Fixed (data)**: DB — Cleared stale `/uploads/1775263577451-cdhspu5d5xt.png` hero image path from restaurant 1 ("Resto"), which was rendering a broken chat screenshot. Now falls back to the clean 🥐 croissant emoji gradient placeholder.

## Business-Type Enforcement Policy

**All features must support all three business types: `restaurant`, `cafe`, `bar`.** No logic, UI text, monetization tool, analytics view, or email copy should be hardcoded for "restaurant" only.

### Shared Helper
`artifacts/restosmart/src/lib/biz-copy.ts` — Central BizType helper. All frontend components read `getBizType()` from localStorage key `restosmart_owner_business_type` and use the exported label maps (BIZ_LABEL, BIZ_POSSESSIVE, BIZ_MENU_LABEL, BIZ_SETUP_TITLE, etc.). Import from here, never hardcode "Restaurant".

### Fixes Applied (Business-Type Enforcement Pass)
- **`billing.tsx`**: Plan card title, subtitle, module list (Reservierungsverwaltung, Tischplan, Speisekarten-Editor, cancellation text) now all adapt via `BIZ_*` maps.
- **`overview.tsx`**: "Ihr Restaurant ist live" → `{bizPossessive} ist live` for the 24h no-booking alert.
- **`onboarding.tsx`**: All steps now type-adaptive — step indicator labels, Step1 (title, name label, cuisine label, description placeholder, email placeholder), Step2 (menu title, subtitle, empty state, add hint, page link), Step4 (marketplace activation description), page title + subtitle, all toast messages.
- **`api-server/src/routes/overview.ts`**: `AVG_SPEND_PER_COVER` is now type-specific (restaurant=€35, café=€12, bar=€18). `tableTotal` is now type-specific (restaurant=20, café=14, bar=16). Both are fetched from the `restaurants` table `businessType` field on every request.
- **`api-server/src/services/email.ts`**: "direkt an das Restaurant" → "direkt an das Lokal"; "bei uns gespeist haben" → "bei uns zu Gast waren"; "Tisch buchen" CTA → "Jetzt entdecken"; "Danke, dass Sie bei uns gegessen haben" → "Danke für Ihren Besuch".

### Already Type-Aware (no changes needed)
- `monetization-engine.ts` — `BOOST_CONFIGS.bizTypes` gates, `PREMIUM_VALUE_BY_TYPE`
- `premium-value-panel.tsx` — Type-specific headlines and benefit lists  
- `layout.tsx` — "Café-Betreiber" / "Bar-Betreiber" / "Restaurantbesitzer" nav identity
- `founder.tsx` — BIZ_ICONS, BIZ_COLORS, BIZ_LABELS for pipeline view
- `digital-twin.ts` / `life-loop-engine.ts` — businessType drives affinity and mode

## System Integration + Cross-System Behavior Pass

Four targeted integration wires added — no new features, just existing systems actually talking to each other:

- **I-1 (Life Loop → Homepage)**: `home.tsx` now imports `evaluateLifeLoop()` + `getTwin()` and computes a `lifeLoop` decision on every render. The `sectionOrder` array from the engine now drives whether social sections (ActivityFeed, GroupSuggestions) render **before** or **after** LiveSections. In the evening/night or when friends are active, social surfaces bubble up; at lunchtime, live activity leads. The `contextHint` string is now displayed in the hero as a subtle `<Sparkles />` insight strip when `confidence >= 0.65` (user has ≥ 10 interactions).
- **I-2 (Social cues → SmartReminders)**: `smart-reminders.tsx` now fetches `/api/social/group-suggestions/:email` as a 4th trigger source. If friends are active at a venue right now, a "X & Y sind gerade aktiv — {RestaurantName}" card appears in the notification overlay, linking directly to that restaurant.
- **I-3 (Friend cues → Hyper-local ranking)**: `hyper-local.ts` `computeHyperLocalScore()` now accepts a `friendCueCount` parameter. Friend activity at a venue adds up to +1.5 pts to the hyper-local score (capped). `rankHyperLocal()` now accepts the full `cues` record and maps cue counts to restaurant IDs before scoring. `NearYouNow` accepts a `cues` prop and passes it through; home.tsx passes the live `cues` from `useSocialCues()`. Cards now show a blue "N Freunde hier" badge when `friendCueCount > 0`.
- **I-4 (Meal plan → Auto plans)**: `auto-plans-engine.ts` `evaluateAutoPlans()` accepts `hasTodayMealPlan?: boolean`. If the user has a meal plan for today AND the auto-plan mode is `lunch_plan`/`group_dinner` during the relevant time window (11–14 / 17–21), the auto-plan card is suppressed (`triggerReason: "meal_plan_active"`) — preventing the app from contradicting the user's own stated intent. Home.tsx fetches today's meal plan and passes the flag.

## Behavior Priority Engine (Ranking Brain + Sponsored Boost System)

The platform's unified discovery ranking system. All discovery surfaces use the same brain.

### Architecture

**Client-side (`artifacts/customer/src/lib/ranking-engine.ts`)** — The single source of truth for ranking:
- `rankVenues(restaurants, ctx)` → `RankedVenue[]` — Full personalized ranking for Smart Offers / Near You Now / Search. Wraps `scoreRestaurant()` from smart-offers.ts, adds fairness gates, budget-aware boost scoring, and `isSponsored` flag.
- `rankByContext(restaurants, mode, limit)` → `RankedVenue[]` — Context-free ranking for "Top in Wien" section. Uses time-matched business type + rating + budgeted boost. No user prefs needed.

**Ranking formula:**
```
finalScore = relevanceScore * (closedMultiplier * distanceMultiplier) + boostScore
```
- `relevanceScore` = smart-offers score (prefs, location, lifestyle mode, allergens, rating, availability)
- `closedMultiplier` = 0.4 if closed (strong penalty; venue stays visible in "allow closed" mode)
- `distanceMultiplier` = 0.25 if >10km, 0.65 if >6km, 1.0 otherwise
- `boostScore` = 0-12 pts, ONLY applied when: budget remaining > 0 AND time-window matches business type

**Time-aware boost (Rule 6):** A bar's Nightlife Boost scores 1.0x at night, 0.2x in the morning.

### Transparency (Rule 9)
- `RankedVenue.isSponsored` = true only when boost is active AND budget not exhausted
- Customer cards show "Gesponsert" chip when `isSponsored: true` — in `restaurant-card.tsx` and `smart-offers-section.tsx`
- No hidden paid placement; every boosted result is labeled

### Budget System
- New columns on `promotions` table: `daily_budget NUMERIC(8,2)`, `spent_today NUMERIC(8,2)`, `budget_reset_date DATE`
- `POST /api/promotions/restaurant/:id/impression` now deducts €0.01/impression, resets daily on new day, returns `budgetRemaining`
- `GET /api/promotions/budget?restaurantId=:id` — returns budget state for all active promotions
- `PUT /api/promotions/:id/budget` — set daily budget (0 = unlimited, no cap)
- Budget-exhausted boosts: `isSponsored = false`, no boost score added, no "Gesponsert" label shown

### Marketplace API Sort (Rule 4: Relevance First)
- Old: naively sorted by `hasActiveBoost ? 1 : 0` then rating — boosted venues always ranked #1
- New: `rating * 0.7 + (budgetedBoost ? 1.5 : 0)` — boost is a controlled uplift, not a rank override
- API now returns `boostBudgetRemaining`, `boostDailyBudget`, `boostSpentToday` per restaurant

### Compliance Fixes
- **Fake labels (Rule 2)**: `live-activity.ts` — "Trending jetzt" → "Sehr beliebt", "Hot jetzt" → "Beliebt", "Gerade beliebt" → "Gefragt". `stableNoise()` function removed entirely.
- **Trending section (Rule 2+3)**: "Trending in Wien" (pure rating sort) → "Top in Wien" (uses `rankByContext()` with time + type matching)
- **Sponsored disclosure (Rule 9)**: "Gesponsert" chip added to all discovery card variants

### Discovery Surfaces Wired
- `home.tsx` — Top in Wien section uses `rankByContext()`; SmartOffersSection and NearYouNow receive `boostBudgetRemaining` from API; sponsored chips shown
- `explore.tsx` — List cards show `isSponsored` from boost + budget data; server sort is now fair
- `smart-offers-section.tsx` — SmartOfferCard shows "Gesponsert" chip inline with reason chip
- `restaurant-card.tsx` — Accepts `isSponsored?: boolean` prop

### Owner Dashboard Budget UI (`promotion-tools.tsx`)
- "Tagesbudget" section appears when promotions are active
- Per-boost budget card: progress bar (green/amber/red), daily budget vs spent, remaining
- Budget picker: preset buttons (€5, €10, €20, €50/day) + custom input
- Budget-exhausted indicator: red chip "Budget aufgebraucht"
- Info note: explains "Gesponsert" label transparency to owners

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/api-server run dev` — run API server locally
