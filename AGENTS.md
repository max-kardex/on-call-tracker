<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# On-Call Tracker — Agent Context

## Project Overview

An on-call rotation tracker for L3 Software Engineer support teams. Handles weekly rotations, manual call logging, self-service swaps, PTO compensation estimation, severity tracking, and Slack notifications. Deployed on Vercel (primary) or Docker.

## Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Next.js | 16.2.6 | App Router, Turbopack |
| Language | TypeScript | 5.x | `noImplicitAny: false` in tsconfig |
| Database | PostgreSQL | 15+ | Via Prisma adapter |
| ORM | Prisma | 7.8.0 | Uses `@prisma/adapter-pg` with `PrismaPg({ connectionString })` |
| Auth | NextAuth (Auth.js) | v5-beta.31 | GitHub OAuth, PrismaAdapter |
| UI | shadcn/ui | 4.7.0 | `base-nova` style (Base UI primitives, NOT Radix) |
| CSS | Tailwind CSS | v4 | PostCSS plugin, no config file |
| Components | @base-ui/react | 1.4.1 | Underlying primitives for shadcn |
| Font | Geist + Geist Mono | via next/font | CSS vars: `--font-geist-sans`, `--font-geist-mono` |
| Theme | next-themes | 0.4.6 | Dark mode default, class-based |
| Notifications | Slack webhooks | — | Configurable in Settings UI |
| Analytics | @vercel/analytics | latest | Auto page view tracking |
| Deployment | Vercel (primary) | — | Docker secondary |

## Critical Architecture Decisions

### Prisma 7 Setup
- Generator: `prisma-client-js` (not the new `prisma-client`) for NextAuth adapter compatibility
- Adapter: `new PrismaPg({ connectionString })` — NO `pg.Pool` (causes serverless connection exhaustion)
- Client singleton in `src/lib/prisma.ts` using `globalThis` caching
- `prisma generate` runs in both `postinstall` and `build` scripts for Vercel
- `prisma/seed.ts` excluded from tsconfig (not part of Next.js build)

### Auth (No Middleware)
- `middleware.ts` was REMOVED — Next.js 16 deprecated the `middleware` convention
- Auth is enforced via:
  - `requireAuth()` from `src/lib/auth-guard.ts` in server component layouts
  - `requireApiAuth()` from `src/lib/api-auth.ts` in API route handlers
- The `(app)` layout calls `requireAuth()` which redirects to `/login` if unauthenticated

### shadcn/ui (Base UI variant)
- Uses `@base-ui/react` primitives — NOT `@radix-ui/react`
- No `asChild` prop, no `forceMount`
- Triggers render their own elements (not composable via render prop in most cases)
- `SelectValue` may show raw `value` prop instead of label — use explicit children rendering
- `DropdownMenuTrigger` takes direct children (not `render` prop)
- Custom CSS variants (`data-open`, `data-closed`, etc.) are inlined in `globals.css`
- `shadcn/tailwind.css` import was replaced with inlined content for Vercel compatibility

### CSS / Fonts
- Font variables: `--font-sans: var(--font-geist-sans)` (NOT circular self-reference)
- Theme colors use `oklch()` color space
- Dark variant: `@custom-variant dark (&:is(.dark *))`
- All theme CSS variables defined in `:root` and `.dark` in `globals.css`

### Route Groups
- `(app)` — Authenticated pages with sidebar layout, onboarding guard
- `(auth)` — Login page (unauthenticated)
- `(onboarding)` — Onboarding flow (authenticated, no sidebar, no onboarding guard)

### Onboarding Flow
- New users have `onboarded: false` by default
- `(app)` layout checks `onboarded` flag and redirects to `/onboarding` if false
- `/onboarding` page redirects to `/dashboard` if already onboarded
- On completion: sets `fullName`, `preferredContact`, and `onboarded: true`

### Dynamic Pages
- All pages that query the database use `export const dynamic = "force-dynamic"`
- All API routes use `export const runtime = "nodejs"`
- `next.config.ts` conditionally sets `output: "standalone"` only when NOT on Vercel

## Database Schema (Key Models)

```
User: id, name (GitHub username), fullName, email, image, role (ADMIN|ENGINEER),
      preferredContact (SMS|SLACK|TEAMS|CALL), onboarded, isActive

Schedule: id, userId, weekStart, weekEnd, isOverride, isSelfAssigned, notes
CallLog: id, userId, severity (P1-P4), startTime, endTime, duration, summary, notes, resolution
SwapRequest: id, requesterId, targetId, scheduleId, targetScheduleId, type (FULL_WEEK|SPECIFIC_DAYS), status (PENDING|APPROVED|REJECTED|CANCELLED), reason
PtoCompensation: id, userId, period, hoursCompensated, calculatedAt
CompensationRule: id, severity, hoursPerCall, multiplier, description
SlackConfig: id, webhookUrl, channelName, notifyOnRotation, notifyOnSwap, notifyOnHighSeverity
```

### Self-Assignment (Volunteering)
- Engineers can self-assign to any unassigned future week from the Schedule page
- Self-assigned entries have `isSelfAssigned: true` on the Schedule model
- Calendar view shows "Take" button (Hand icon) on Monday cells of open weeks
- List view interleaves open-week cards (dashed border) with assigned entries
- Users can withdraw their own self-assigned weeks (non-admins cannot delete others')
- Rotation generation deprioritizes self-assigned engineers: `[...regularPool, ...selfAssignedPool]`
- Self-assigned weeks are never overwritten by rotation generation
- Slack notification fires when someone self-assigns (`notifyVolunteer()`)

### Guide Page
- Located at `/guide` under `(app)` route group
- Shows all features: rotation, self-assignment, call logging, swaps, PTO compensation, Slack, roles
- Pulls live `CompensationRule` entries from DB and renders them in a table
- Accessible to all authenticated users (engineers + admins)
- Nav item with `BookOpen` icon between "Reports" and "Settings"

## File Structure

```
src/
├── app/
│   ├── (app)/                 # Authenticated app (has sidebar + onboarding guard)
│   │   ├── layout.tsx         # Auth + onboarding check, sidebar shell
│   │   ├── dashboard/         # Stats, recent calls, upcoming rotation
│   │   ├── schedule/          # Month calendar + list view, rotation generation
│   │   ├── calls/             # Call log table, CRUD, filters, pagination
│   │   ├── swaps/             # Swap requests, approve/reject/cancel
│   │   ├── reports/           # PTO compensation calculation + CSV export
│   │   ├── guide/             # How-it-works page with live compensation rules
│   │   └── settings/          # Team mgmt, compensation rules, Slack config
│   ├── (auth)/login/          # GitHub OAuth sign-in
│   ├── (onboarding)/onboarding/ # First-time user setup (fullName + contact)
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── profile/           # GET/PUT user profile
│       ├── schedule/          # CRUD + rotation generation + self-assign
│       ├── calls/             # CRUD + Slack P1/P2 alerts
│       ├── swaps/             # Create + status management
│       ├── compensation/      # Calculation + CSV export
│       ├── settings/          # Slack webhook config
│       └── users/             # List users (admin)
├── components/
│   ├── nav/                   # sidebar.tsx, mobile-nav.tsx, user-nav.tsx
│   ├── ui/                    # shadcn/ui components (Base UI based)
│   ├── providers.tsx          # SessionProvider + ThemeProvider
│   ├── profile-modal.tsx      # Edit profile dialog
│   └── theme-switcher.tsx     # Light/Dark/System toggle
├── lib/
│   ├── auth.ts                # NextAuth config + GitHub provider
│   ├── auth-guard.ts          # requireAuth(), requireAdmin()
│   ├── api-auth.ts            # requireApiAuth() for routes
│   ├── prisma.ts              # PrismaClient singleton (PrismaPg adapter)
│   ├── slack.ts               # Webhook notification helpers
│   └── utils.ts               # cn() utility
prisma/
├── schema.prisma              # All models + enums
├── seed.ts                    # Sample data seeder
docker-compose.yml             # PostgreSQL + app
Dockerfile                     # Multi-stage build
```

## Common Patterns

### Adding a new page
1. Create directory under `src/app/(app)/your-page/`
2. Add `page.tsx` (server component) with `export const dynamic = "force-dynamic"`
3. Auth is inherited from `(app)/layout.tsx`
4. Add nav link in `src/components/nav/sidebar.tsx`

### Adding a new API route
1. Create `src/app/api/your-route/route.ts`
2. Add `export const runtime = "nodejs"` at top
3. Use `auth()` from `@/lib/auth` for session checks
4. Use `prisma` from `@/lib/prisma` for DB access

### UI Components
- Import from `@/components/ui/`
- Use `cn()` from `@/lib/utils` for class merging
- All buttons should have lucide icons + text
- Loading states use `<Spinner />` from `@/components/ui/spinner`
- Select components need explicit `SelectValue` children for friendly display names

### Environment Variables
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `NEXTAUTH_URL` | Dev only | Not needed on Vercel (auto-detected) |
| `SLACK_WEBHOOK_URL` | No | Can be configured in Settings UI instead |

## Deployment Notes

### Vercel
- `prisma generate` runs automatically via `postinstall` and `build` script
- `output: "standalone"` is NOT set (Vercel manages its own bundling)
- `prisma db push` must be run manually against production DB after schema changes
- GitHub OAuth callback URL: `https://<domain>/api/auth/callback/github`

### Docker
- `output: "standalone"` is conditionally enabled (when `VERCEL` env not present)
- `docker-compose.yml` includes PostgreSQL
- Multi-stage Dockerfile for minimal production image

## Schema Migrations
After changing `prisma/schema.prisma`:
- Local: `npx prisma migrate dev --name description`
- Production: `DATABASE_URL="prod-url" npx prisma db push`
- Always run `npx prisma generate` to update the client types
