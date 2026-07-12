# Architecture

The App Router renders role-oriented workspaces. Route handlers and server actions validate untrusted input, load the authenticated actor, check RBAC and department scope, then call transactional domain services. Prisma is the only application database gateway; SQLite is authoritative. Lifecycle transitions, notifications, and activity logging are centralized. The worker is idempotent through notification and job-run deduplication.
