# Testing

Unit tests cover lifecycle and permission rules. Integration suites require a dedicated PostgreSQL URL and validate concurrent allocation, booking exclusion, signup security, maintenance state, and the complete custody/audit scenario. Playwright authenticates every demo role and checks role-aware navigation and core workspaces. CI applies migrations and seed data before all checks. Never point integration tests at production.

Verified locally: 12 unit/integration tests and 5 Playwright tests passed against PostgreSQL 18.4.
