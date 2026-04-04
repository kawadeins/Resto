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

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/api-server run dev` — run API server locally
