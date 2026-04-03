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

## Auth

- Super-admin: `X-Super-Admin-Key` header, env var `SUPER_ADMIN_KEY` (default: `restosmart-super-2025`)
- Customer: email-based identity stored in localStorage (`restosmart_email`)
- Geo: sessionStorage (`restosmart_geolocation`)

## Email

- Resend library, `FROM_EMAIL` env var, logs to notification_logs, never throws
- Generic `sendEmail()` helper in `artifacts/api-server/src/lib/email.ts`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/api-server run dev` — run API server locally
