# RestoSmart — Restaurant Management SaaS

## Overview

RestoSmart is a premium restaurant management dashboard built as a full-stack SaaS web app. It targets restaurant owners who need a professional, information-dense operating system for managing their restaurant.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (dark theme)
- **UI Components**: Shadcn/ui (Radix UI), Lucide icons, Recharts
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Routing**: Wouter

## Artifacts

- **`artifacts/restosmart`** — Frontend React + Vite app (preview path: `/`)
- **`artifacts/api-server`** — Express 5 backend API (preview path: `/api`)

## Key Database Tables
- `employees`, `shifts` — staff and weekly shift schedule
- `shift_attendance` — per-shift daily attendance records (status, confirmation timestamp, reminder deduplication)
- `notification_logs` — all email/notification audit trail
- `reservations`, `discounts`, `pos_sales`, `inventory` — core operations
- `pilot_feedback` — pilot programme feedback

## Features (Phase 1)

### Overview Dashboard
- Today's Profit, Active Staff, Low Stock Alerts, Table Occupancy stats
- Monthly Revenue vs Profit area chart (12 months of data)

### Staff Management
- Employee list with name, role, contact, status badge
- Add / Edit / Delete employees via dialogs
- Weekly Rota grid (Mon–Sun) with shift assignment per employee

### Inventory
- Stock list with category, quantity, unit, cost per unit
- Low Stock alerts (highlighted in red when quantity ≤ alert threshold)
- Add / Edit / Delete inventory items

### Finances
- YTD Revenue, Net Profit, Avg Profit Margin, Avg Daily Revenue stats
- Monthly Revenue Breakdown bar chart
- Top Dishes ranking (derived from sales records)
- Smart Discount Agent — toggle, percentage slider, time range, days-of-week

## Database Schema

- `employees` — id, name, role, email, phone, status
- `shifts` — id, employee_id (FK), day_of_week, start_time, end_time
- `inventory` — id, name, category, quantity, unit, alert_threshold, cost_per_unit
- `sales` — id, date, revenue, profit, popular_dishes[], covers
- `discounts` — id, enabled, percentage, start_time, end_time, days[]

## API Routes

- `GET /api/overview/summary` — Dashboard KPI stats
- `GET /api/overview/sales-chart` — Monthly chart data
- `GET/POST /api/employees` — Employee list and create
- `GET/PUT/DELETE /api/employees/:id` — Employee detail/update/delete
- `GET/POST /api/shifts` — Shift list and create
- `DELETE /api/shifts/:id` — Delete shift
- `GET/POST /api/inventory` — Inventory list and create
- `PUT/DELETE /api/inventory/:id` — Update/delete inventory item
- `GET /api/inventory/low-stock` — Low stock items only
- `GET/POST /api/sales` — Sales records
- `GET /api/sales/finances-summary` — Financial aggregates
- `GET/PUT /api/discounts` — Smart discount settings

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
