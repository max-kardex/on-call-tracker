# On-Call Tracker - Implementation Complete

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Docker Compose)

### Option 1: Docker Compose (Recommended for local dev)
```bash
# Copy environment file
cp .env.example .env

# Fill in AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in .env
# (Create a GitHub OAuth App at https://github.com/settings/developers)

# Start PostgreSQL + app
docker compose up -d

# Run migrations
npx prisma migrate deploy

# Seed with sample data
npm run db:seed
```

### Option 2: Manual Setup
```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and GitHub OAuth credentials

# Generate Prisma client
npm run db:generate

# Create database tables
npm run db:migrate

# Seed sample data (optional)
npm run db:seed

# Start dev server
npm run dev
```

### Vercel Deployment
1. Push to GitHub
2. Connect repo in Vercel
3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL` (use Vercel Postgres, Neon, or Supabase)
   - `AUTH_SECRET`
   - `AUTH_GITHUB_ID`
   - `AUTH_GITHUB_SECRET`
4. Deploy

## Features Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| Authentication | Done | GitHub OAuth via NextAuth v5 |
| Dashboard | Done | Overview of current on-call, stats, recent calls, pending swaps |
| Schedule Management | Done | Weekly rotation calendar, auto-generation (round-robin), manual overrides, reassignment |
| Call Logging | Done | Full CRUD with severity (P1-P4), notes, duration tracking, resolution |
| Swap System | Done | Self-service swap requests, approve/reject flow, auto schedule update |
| PTO Compensation | Done | Configurable rules engine, per-period calculation, CSV export |
| Slack Integration | Done | Webhook notifications for rotations, swaps, high-severity calls |
| Docker Support | Done | Multi-stage Dockerfile, docker-compose with PostgreSQL |
| Admin Settings | Done | Team management, compensation rules, Slack configuration |

## Architecture

- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma 7 ORM with PG adapter
- **Auth**: NextAuth v5 (Auth.js) with GitHub OAuth
- **UI**: Tailwind CSS v4 + shadcn/ui (Base UI)
- **Deployment**: Vercel-first, Docker secondary

## Project Structure

```
src/
├── app/
│   ├── (app)/           # Authenticated app pages
│   │   ├── dashboard/   # Main dashboard
│   │   ├── schedule/    # Rotation calendar + generation
│   │   ├── calls/       # Call log CRUD
│   │   ├── swaps/       # Swap request management
│   │   ├── reports/     # PTO compensation reports
│   │   └── settings/    # Admin configuration
│   ├── (auth)/          # Login page
│   └── api/             # API routes
├── components/
│   ├── nav/             # Sidebar, mobile nav, user dropdown
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── auth.ts          # NextAuth configuration
│   ├── prisma.ts        # Prisma client singleton
│   ├── slack.ts         # Slack webhook utility
│   └── utils.ts         # Utility functions
└── types/               # TypeScript declarations
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Random secret for NextAuth session encryption |
| `AUTH_GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `NEXTAUTH_URL` | Dev only | App URL (auto-detected on Vercel) |
| `SLACK_WEBHOOK_URL` | No | Optional, can be configured in Settings UI |
