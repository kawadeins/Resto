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
-   **Social Privacy & Friends System:** Full friends system with send/accept/decline flows, friends panel in Profile Hub. Public profiles at `/u/:email` show name/photo/bio/city/posts and support FriendButton + MessageButton. Private profiles (`is_private=true`) show only name and avatar to non-friends. Friendship status returned by API.
-   **Direct Messaging System:** Full DM + group chat at `/messages` and `/messages/:convId`. DB tables: `conversations`, `conversation_participants`, `direct_messages`, `blocked_users`, `muted_conversations`. Features: 3-second polling, read receipts, block/mute per conversation, group creation, DM requires accepted friendship. Messages accessible from friends panel and public profiles — not in main nav.
-   **Profile Hub (Customer):** The customer `/profile` page is the personal/social identity hub. The hero shows 4 stats + a ⚙️ gear icon linking to `/settings`. Exactly 4 tabs: Übersicht (loyalty card, Level/XP card, Quick Actions grid, Plans preview, visited restaurants, friends mini), Geschmack (cuisines, dietary style, allergies), Freunde (FriendsPanel + "Gemeinsam ausgehen" CTA), Aktivität (booking history, points overview, activity feed + Einstellungen link). Business owner identity (OwnerPremiumCard) has been moved to Settings — it no longer appears in the Profile hub.
-   **Einstellungen Page (Customer):** A dedicated `/settings` page accessed via the gear icon in the Profile hero. Single-scroll layout (no tabs) with clearly separated sections: Konto (avatar, name edit, email read-only), Business-Bereich (restaurant dashboard or premium CTA), Benachrichtigungen (3 toggles), Datenschutz (data info + export), Habit & Fortschritt (streak numbers, daily missions), Aktive Sitzungen, Feedback & Bewertung, Rechtliches & Hilfe, Abmelden (logout), Gefahrenzone (delete account). Redirects to /profile when not logged in. Lazily initializes email from localStorage to prevent redirect race conditions.
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
-   **High-Retention Engagement System:** Multi-layer behavioral loop driving DAU:
    - **DailyHookBanner:** Time-of-day contextual banner (morning ☕ / lunch 🍜 / evening 🌆 / night 🌙) with rotating daily content chips (Top Spots heute, Nur heute Rabatte, Trending in Wien) — dismissible per session.
    - **Time-Aware Hero Headlines:** RotatingHeroHeadline now cycles through time-slot specific messages (morning greetings vs. night Nachtleben headlines).
    - **XP Toast System:** `XpToastProvider` global context + floating "+10 XP" animation triggered on like, booking, post. `useXpGain()` hook available to any component.
    - **Level-Up Celebration Modal:** Spring-animated modal with confetti burst when user crosses tier thresholds (Bronze→Silver→Gold→Elite). `checkAndShowLevelUp()` called in PersonalizedSection.
    - **Elite Tier:** Added 4th loyalty tier (500+ pts) to TIER_CONFIG with primary/accent gradient treatment.
    - **PostBookingTrigger:** Slide-up "Lade Freunde ein!" card that appears 600ms after a successful booking.
    - **PostScrollTrigger:** "Noch mehr entdecken →" CTA that appears when user scrolls to 88% of the page.
    - **FOMO Live Viewer Count:** Deterministic "X schauen gerade" badge on restaurant cards (based on restaurantId + hour seed, shown only during peak hours 10-23).
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

## Brand Identity System

**Color tokens (both apps):**
- Primary: `hsl(263 70% 52%)` — deep violet (dark: `263 70% 65%`)
- Accent: `hsl(330 85% 58%)` — vibrant pink (dark: `330 85% 65%`)
- Brand gradient: `linear-gradient(135deg, #8b5cf6, #ec4899)` (violet → pink)

**CSS utilities available in both apps:** `.gradient-text`, `.gradient-btn`, `.press-scale`, `.scrollbar-hide`, `.glass`

**Typography:** Inter (body) + Plus Jakarta Sans (headings)

**Sidebar (restosmart):** Always dark — `sidebar: 240 15% 8%` — layout wrapper locked to `.dark`

**Logo:** `RestoLogo` component in both apps: `from-primary to-accent` gradient circle icon + "Resto" gradient text + "Smart" foreground text. Sizes: sm/md/lg/xl. `inverted` prop for dark backgrounds.

**Promotion components:** All `C.grad` uses brand violet→pink; all blue hex colors (#4F8CFF, #7B5CFF, #7B8CFF) replaced with brand equivalents.

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

## i18n Migration (COMPLETE)

Full internationalization (8 languages: de/en/fr/it/es/nl/pt/tr + pl) wired across both apps.

**Customer app (14/14 pages migrated):**
`explore.tsx`, `feed.tsx`, `for-business.tsx`, `friends.tsx`, `home.tsx`, `meal-plan.tsx`,
`messages.tsx`, `my-bookings.tsx`, `not-found.tsx`, `plan-detail.tsx`, `profile.tsx`,
`public-profile.tsx`, `restaurant.tsx`, `settings.tsx`

**RestoSmart dashboard (25/25 pages migrated):**
`analytics.tsx`, `billing.tsx`, `bookings.tsx`, `boost.tsx`, `campaigns.tsx`, `finances.tsx`,
`founder.tsx`, `insights.tsx`, `inventory.tsx`, `login.tsx`, `marketing.tsx`, `menu.tsx`,
`not-found.tsx`, `onboarding.tsx`, `optimizer.tsx`, `overview.tsx`, `payroll.tsx`, `pos.tsx`,
`profile.tsx`, `reservations.tsx`, `reviews.tsx`, `staff.tsx`, `super-admin.tsx`, `tables.tsx`, `team.tsx`

**Translation files:** `artifacts/customer/src/i18n/translations.ts` (~770+ lines, all namespaces),
`artifacts/restosmart/src/i18n/translations.ts` (~1106 lines, all namespaces)

**i18n setup:** `localStorage` key `restosmart_lang` (dashboard) / `restosmart_customer_lang` (customer), fallback `de`.

## Monetization System (COMPLETE)

- `artifacts/restosmart/src/components/soft-paywall.tsx` — blurred ghost preview, 24h countdown, one-tap upgrade CTA
- `artifacts/customer/src/components/contextual-premium-trigger.tsx` — RestaurantBrowseTrigger (view count), PostBookingPremiumNudge
- Wired into: `restosmart/analytics.tsx` (SoftPaywall), `customer/restaurant.tsx` (both triggers)

## External Dependencies

-   **Database:** PostgreSQL
-   **ORM:** Drizzle ORM
-   **Email Service:** Resend (requires `RESEND_API_KEY`)
-   **UI Components:** Radix UI (via Shadcn/ui), Lucide icons
-   **Charting:** Recharts
-   **Mapping:** Leaflet/OpenStreetMap
-   **Payment Gateway:** Stripe
-   **AI Model:** GPT-4o-mini (via Replit AI Integrations)