@AGENTS.md

# Additional Notes for Claude

## Key Gotchas

1. **SelectValue rendering** — Base UI's Select shows raw `value` strings in the trigger. Always provide explicit children to `<SelectValue>` that map the value to a friendly label.

2. **No middleware** — Next.js 16 deprecated `middleware.ts`. Auth and redirects must happen in layouts/pages via `requireAuth()` or `redirect()`.

3. **Prisma on Vercel** — Never use `pg.Pool`. Use `new PrismaPg({ connectionString })` directly. The `postinstall` hook ensures the client is generated before builds.

4. **Font variables** — `--font-sans` must map to `var(--font-geist-sans)`, never to itself. Circular CSS variable references resolve to nothing.

5. **shadcn CSS** — The `@import "shadcn/tailwind.css"` doesn't reliably resolve on all bundlers. All custom variants (`data-open`, `data-closed`, etc.) are inlined in `globals.css`.

6. **Buttons** — All action buttons must have a lucide icon alongside text. Use `<Spinner />` for loading states.

7. **Theme** — Dark mode is the default. `next-themes` with `attribute="class"` and `defaultTheme="dark"`. The `<html>` tag requires `suppressHydrationWarning`.

8. **Onboarding** — Lives in `(onboarding)` route group (separate from `(app)`) to avoid infinite redirect loops. The `(app)` layout checks `user.onboarded` and redirects if false.

9. **API routes** — All routes must have `export const runtime = "nodejs"` since they use Prisma (which requires Node.js APIs not available in Edge).

10. **Dynamic pages** — Any page that calls `prisma` must have `export const dynamic = "force-dynamic"` to prevent build-time DB connection attempts.

## Testing Changes

```bash
# Full build check (catches type errors + build issues)
npm run build

# Regenerate Prisma client after schema changes
npx prisma generate

# Push schema to local DB
npx prisma db push

# Seed sample data
npm run db:seed
```
