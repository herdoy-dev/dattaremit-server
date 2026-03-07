# Project Rules for Claude Code

## Workflow

- **Always run tests before committing.** After any code change, run `npx jest --forceExit --detectOpenHandles` and verify all tests pass before creating a commit.
- **Never commit if tests fail.** Fix the issue first, re-run tests, then commit.
- **Always push after committing** unless explicitly told otherwise.
- **Remote uses SSH:** `git@github.com:abhishek-riverpe/dattaremit-server.git`

## Project Stack

- **Runtime:** Bun
- **Framework:** Express 5 with TypeScript
- **Database:** PostgreSQL via Prisma ORM (with `@prisma/adapter-pg`)
- **Auth:** Clerk (`@clerk/express`)
- **Validation:** Joi schemas
- **Testing:** Jest + Supertest (run with `npx jest`, not `bun test`)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — runs tests on every push/PR

## Code Conventions

- Controllers use `asyncHandler` wrapper from `lib/async-handler.ts` — no manual try-catch blocks
- Validation uses `validate()` helper from `lib/validate.ts` — no inline Joi validation
- Common Joi fields (firstName, lastName, email, phone, etc.) are defined in `schemas/common.schema.ts` — reuse them
- Auth error handling uses `handleAuthError()` from `lib/auth-error-handler.ts`
- API responses use `new APIResponse(success, message, data?)` from `lib/APIResponse.ts`
- Errors use `new AppError(status, message)` from `lib/AppError.ts`
- Test environment variables live in `.env.test` (loaded via dotenv in `tests/setup.ts`)
- No hardcoded credentials or secrets in source code

## File Structure

```
controllers/   → Route handlers (use asyncHandler + validate)
services/      → Business logic
repositories/  → Database access layer
schemas/       → Joi validation schemas + TypeScript types
middlewares/   → Express middleware (auth, db-user, error, etc.)
lib/           → Shared utilities (crypto, logger, prisma-client, etc.)
routes/        → Express route definitions
tests/         → Jest test files
  helpers/     → Test utilities (app setup, auth mocks, mock data)
```
