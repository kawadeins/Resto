# RestoSmart — Restaurant Management SaaS

## Overview

RestoSmart is a full-stack SaaS web application designed to provide restaurant owners with a comprehensive, information-dense dashboard for optimizing operations. It centralizes management of staff, inventory, finances, marketing, and customer interactions to drive growth. Key features include smart staff management, dynamic table availability, review management, and advanced analytics. The platform also offers a customer-facing marketplace for restaurant discovery, loyalty programs, and meal planning. Strategic ambitions include competitive intelligence, AI-driven operations, and city expansion capabilities, aiming for market leadership.

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

-   **Owner Dashboard:** Dark theme, professional aesthetic, focusing on actionable insights for KPIs, Staff Management, Table Availability, Reviews & Reputation, Inventory, Finances, Analytics, Marketing, POS, Menu, Billing, and Profile. Includes a premium system with trial conversion mechanisms.
-   **Customer Marketplace:** Warm/foodie aesthetic for restaurant discovery, featuring modules for Home (deals), Explore (listings, map view), Near You Now (hyper-local scoring), Restaurant Detail (booking), My Bookings, Profile Hub, and Meal Plan.
-   **Premium Auto-Conversion Optimization Loop:** A/B testing framework for optimizing conversion elements with auto-win logic and in-app conversion tracking.
-   **Smart Dynamic Pricing System:** Computes real-time boost prices based on demand, time, slot, location, and weekend multipliers, with AI suggestions and auto-optimization.
-   **Boost Wallet System:** Prepaid credit system for running boost campaigns, including top-up functionality, transaction history, and low-balance warnings.
-   **Team Management & Access Control:** Supports owner, manager, and staff roles with granular permissions, invite flows, and role-based UI locking. All mutating endpoints are secured based on roles.
-   **Review Intelligence System:** Features negative review recovery, AI-powered smart reply suggestions (premium only) for business responses, and impact tracking for rating improvements. Low-rated reviews are intercepted for private resolution before public posting.
-   **Business Self-Serve Growth Loop:** Dedicated landing page (`/for-business`) for instant trial activation and an in-dashboard Growth Activation Hub with checklists.
-   **Business Competition Engine:** Provides competitive insights via dashboard widgets (Visibility Strength, Demand/Competition Signal).
-   **AI Self-Healing Ops Layer & Founder Alert System:** Tracks and auto-heals operational incidents (e.g., billing, boost delivery) with an auto-retry engine and a "Mission Control" interface for founders.
-   **Master Brain + Auto Decision Engine:** Central intelligence system monitoring 26 core systems, assessing health, speed, and risk to generate priority scores and perform safe auto-actions.
-   **City Expansion Engine:** Provides health scores for cities to guide expansion decisions.
-   **Behavior Priority Engine:** Client-side ranking system for discovery surfaces based on relevance and sponsored boost scores, with transparent `isSponsored` indicators.
-   **Auto Revenue Optimization Engine:** Analyzes promotion data to generate business-type-aware recommendations and provides a dashboard with KPIs and ROI feedback.
-   **Dynamic Pricing Engine:** Computes real-time impression costs with owner-facing panels and founder configuration controls.

**Authentication (Hardened — Production-Ready):**
-   **Two-Step OTP Login:** Email-based OTP authentication with PostgreSQL session storage, rate limiting, and replay protection.
-   **Google OAuth 2.0 (optional):** Integration for Google Sign-In, creating identical sessions to OTP flow.
-   **Apple Sign-In (optional):** Integration for Apple Sign-In, resolving identity and creating sessions. Uses `oauth_accounts` table to map provider IDs to emails.
-   **Login Page:** Redesigned login page supporting OTP and conditional display of social login buttons.
-   **Rate Limiters:** Comprehensive rate limiting applied to various endpoints (OTP, wallet top-up, team invites, AI requests, general mutations).
-   **DB Indexes:** Optimized database performance with various indexes on critical tables.
-   **Admin Access:** Support for Super-admin (`X-Super-Admin-Key`) and Founder (`x-founder-key`) access.

**Real Stripe Billing System (Production-Ready):**
-   **Stripe Integration:** Uses `stripe` and `stripe-replit-sync` for managing subscriptions and wallet top-ups.
-   **Hardcoded Stripe price IDs:** Statically mapped price IDs for premium subscription and various wallet top-up amounts.
-   **Checkout Flow:** Initiates Stripe Checkout sessions for subscriptions and one-time wallet payments, redirecting users to Stripe.
-   **Webhooks:** Processes Stripe webhooks (`checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted`) for real-time state synchronization.
-   **Idempotency:** Prevents duplicate webhook processing using `stripe_webhook_events` table.
-   **Stripe Schema:** `stripe-replit-sync` manages 29 tables in the `stripe` schema.
-   **Cancellation & Portal:** Functionality for cancelling subscriptions and accessing the Stripe Billing Portal.
-   **Frontend:** Displays real-time billing status banners and redirects to Stripe for payment actions.

**Architectural Limitations (by design):** Single-tenant (hardcoded restaurant ID 1), no real multi-tenant authentication, email delivery disabled by default without `RESEND_API_KEY`.

## Known Bug Fixes Applied

- **Meal-plan URL mismatch (FIXED):** `home.tsx` and `smart-reminders.tsx` previously called `/api/meal-plan?email=…` (query param) but the API only accepts `/api/meal-plan/:email` (path param). Both now use the correct path-param URL.
- **Wallet top-up CSRF (FIXED):** `wallet-panel.tsx` uses `getCsrfToken()` global getter as primary CSRF source, with session refresh fallback.

## Data State

- **Restaurants:** 41 total, all with Unsplash hero images (5 cuisine types: French/brasserie, Italian pizza, Japanese sushi/ramen, vegetarian, Austrian Heuriger, café, cocktail/bar).
- **Flash Deals:** 2 active demo deals seeded (20% Mittagstisch Flash Deal and 15% Happy Hour Special with countdown timers visible on homepage and restaurant cards).
- **Bookings:** Booking for `max@test.at` on 2026-04-20 at 19:00 (restaurant id=1) — visible in My Bookings after email lookup.

## Customer App Audit (COMPLETE)

All 8 pages verified:
- `/` Home — lifestyle mode, flash deals, personalized offers, restaurant cards ✅
- `/explore` — 41 restaurants, filters (cuisine, price, rating, type), list/map toggle ✅
- `/restaurant/:id` — hero image, booking form, reviews, map, recovery flow ✅
- `/my-bookings` — email lookup, booking display, cancel, inline review form ✅
- `/meal-plan` — weekly food-type planner, restaurant suggestions ✅
- `/friends` — social friend management (empty for new users) ✅
- `/profile` — Apple/Google demo login, loyalty points, food preferences ✅
- `/for-business` — landing page, business claim form, growth signals ✅

All critical API endpoints return 200 and correct data.

## External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Email Service:** Resend (requires `RESEND_API_KEY`)
-   **UI Components:** Radix UI (via Shadcn/ui), Lucide icons
-   **Charting:** Recharts
-   **Mapping:** Leaflet/OpenStreetMap
-   **Payment Gateway:** Stripe
-   **AI Model:** GPT-4o-mini (via Replit AI Integrations)