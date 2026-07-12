# Database

AssetFlow uses SQLite through Prisma. `DATABASE_URL` must be a SQLite file URL, for example `file:./prisma/assetflow.db` for local development.

The active migration history starts with `202607120004_sqlite_baseline`. It creates the normalized workflow schema and SQLite-native partial indexes and triggers for allocation, transfer, booking, lifecycle, return, and audit invariants.

The old PostgreSQL migrations are archived in `prisma/legacy-postgresql-migrations` for reference. They must not be deployed to a SQLite database. Migrating existing production data from PostgreSQL requires a separately planned export, transformation, and import; this repository does not perform destructive cross-database conversion automatically.
