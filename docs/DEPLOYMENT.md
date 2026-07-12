# Deployment

Build the multi-stage Dockerfile on a Docker host, container platform, or behind a reverse proxy. Use managed PostgreSQL 18 where available, run `pnpm db:deploy` exactly once per release, and supply every required environment variable. Set `AUTH_URL`/`APP_URL` to the public HTTPS origin. Persist uploads or configure S3-compatible storage. Vercel can host the Next.js app with external PostgreSQL, but the worker must run separately on a scheduled/container runtime.
