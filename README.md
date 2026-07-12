# AssetFlow

AssetFlow is an enterprise asset and shared-resource management system for accountable custody, bookings, maintenance, audits, and operational reporting.

## Stack

- Next.js, React, TypeScript, Auth.js, Zod, and Prisma
- SQLite for a portable single-file application database
- Vitest and Playwright for automated validation

SQLite constraints and triggers protect active allocations, pending transfers, booking overlaps, asset lifecycle transitions, and immutable completed records. Browser clients never access the database directly.

## Quick start

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm db:seed
pnpm dev
```

The default `DATABASE_URL` is `file:./prisma/assetflow.db`. The database file is local runtime data and is intentionally ignored by Git. For an isolated test database, use another SQLite file URL such as `file:./prisma/assetflow-test.db`.

Docker Compose persists the SQLite database in its `assetflow_data` volume and application uploads in `assetflow_uploads`.

## Environment

Required: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `APP_URL`, `UPLOAD_DRIVER`, `UPLOAD_DIR`, and `CRON_SECRET`.

Optional SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`.

Optional S3: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

## Demo accounts

All seeded accounts use `AssetFlowDemo!2026`.

| Role            | Email                    |
| --------------- | ------------------------ |
| Admin           | admin@assetflow.local    |
| Asset Manager   | manager@assetflow.local  |
| Department Head | head@assetflow.local     |
| Employee        | employee@assetflow.local |
| Auditor         | auditor@assetflow.local  |

## Commands

```bash
pnpm db:deploy
pnpm db:seed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

`prisma/legacy-postgresql-migrations` preserves the historic PostgreSQL migration SQL for reference only. It is not part of the active SQLite migration chain.

## Documentation

See [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [API](docs/API.md), [workflows](docs/WORKFLOWS.md), and [testing](docs/TESTING.md).
