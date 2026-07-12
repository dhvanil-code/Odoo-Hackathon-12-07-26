# Architecture

The App Router renders role-oriented workspaces. Route handlers and server actions validate untrusted input, load the authenticated actor, check RBAC and department scope, then call transactional domain services. Prisma is the only application database gateway; PostgreSQL is authoritative. Lifecycle transitions, notifications, and activity logging are centralized. The worker uses PostgreSQL advisory locking, making a second queue product unnecessary.
