# Deployment

Build the multi-stage Dockerfile on a Docker host, container platform, or behind a reverse proxy. Persist the SQLite database file on durable storage, run `pnpm db:deploy` exactly once per release, and supply every required environment variable. Set `AUTH_URL`/`APP_URL` to the public HTTPS origin. Persist uploads or configure S3-compatible storage. Run the worker separately on a scheduled/container runtime when reminders and escalations are required.
