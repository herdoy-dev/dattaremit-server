# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                                          # Install dependencies
bun run dev                                          # Start dev server (watch mode, port 5000)
bun run start                                        # Start production server
npx jest --forceExit --detectOpenHandles             # Run all tests
npx jest --forceExit --detectOpenHandles <file>      # Run a single test file (e.g. tests/user.test.ts)
npx jest --watch --forceExit --detectOpenHandles     # Run tests in watch mode
npx prisma migrate dev                               # Run Prisma migrations
npx prisma generate                                  # Regenerate Prisma client (output: generated/prisma/)
```

## Workflow

- **Always run tests before committing.** Fix failures before creating a commit.
- **Always push after committing** unless explicitly told otherwise.
- **Remote uses SSH:** `git@github.com:abhishek-riverpe/dattaremit-server.git`
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs tests on every push/PR.

## Project Stack

- **Runtime:** Bun | **Framework:** Express 5 + TypeScript | **Database:** PostgreSQL via Prisma ORM (`@prisma/adapter-pg`)
- **Auth:** Clerk (`@clerk/express`) | **Validation:** Joi | **Testing:** Jest + Supertest (use `npx jest`, not `bun test`)
- **Observability:** Sentry (`@sentry/node`) + Winston logger | **Email:** Resend | **Push notifications:** Expo Server SDK

## Architecture

### Request flow

`index.ts` → global middleware (requestId, cors, helmet, rate-limit, body parsing) → route mounting:
- `/api` (no auth): webhooks, exchange-rate, referral-public routes
- `/api/admin`: admin routes (stricter rate limit)
- `/api` (auth required): all other routes go through `middlewares/auth.ts` → `routes/index.ts`

Auth token is read from `x-auth-token` header, verified via Clerk's `verifyToken`. The `auth` middleware sets `req.user` with only `clerkUserId`. Routes needing the full DB user (e.g. `/api/zynk`) add the `dbUser` middleware which loads the complete user record.

### Layered architecture

Controllers → Services → Repositories → Prisma client

- **Controllers** are class instances with methods wrapped in `asyncHandler` (no try-catch). Validate input via `validate(schema, data)`. Return `new APIResponse(success, message, data?)`.
- **Services** contain business logic and are singletons (`export default new XService()`).
- **Repositories** extend `PrismaRepository<Model>` (base class in `repositories/base.repository.ts`) which provides `findMany`, `findUnique`, `create`, `update`, `delete` with a default `include`.
- **Schemas** define Joi validation schemas and export TypeScript types. Common fields (name, email, phone, etc.) are in `schemas/common.schema.ts` — reuse them.

### Key utilities

- `lib/crypto.ts` — AES-256-GCM encrypt/decrypt and SHA-256 hashing for PII
- `lib/dto.ts` — `toPublicUser()` strips sensitive fields before API responses
- `lib/idempotency.ts` — idempotency key handling for critical operations
- `lib/activity-logger.ts` / `lib/notification-logger.ts` — structured activity and notification logging

### Error handling

- Throw `new AppError(status, message)` for expected errors
- Auth errors go through `handleAuthError()` from `lib/auth-error-handler.ts`
- Global error middleware in `middlewares/error.ts` catches everything

### Prisma

- Schema: `prisma/schema.prisma` | Config: `prisma.config.ts`
- Generated client output: `generated/prisma/` (enums re-exported from `generated/prisma/enums`)
- Client singleton: `lib/prisma-client.ts`

## Testing

Tests mock external dependencies (Prisma, Clerk, crypto, logger, email, Expo) in `tests/helpers/app.ts`. The test app is created via `createTestApp()` which mirrors `index.ts` middleware and route setup.

- `tests/helpers/auth.ts` — `mockAuthAsUser()`, `mockAuthAsAdmin()`, `mockAuthAsActiveUser()`, `AUTH_TOKEN`
- `tests/helpers/mock-data.ts` — shared mock users/data
- `tests/helpers/service-mocks.ts` — service-level mocks
- `tests/setup.ts` — loads `.env.test` via dotenv
- All tests use Supertest against the Express app; no real DB calls
