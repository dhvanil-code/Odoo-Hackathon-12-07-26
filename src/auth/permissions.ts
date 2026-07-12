import type { RoleName } from "@prisma/client";
export type Permission =
  | "org:manage"
  | "roles:manage"
  | "assets:read"
  | "assets:write"
  | "allocations:manage"
  | "transfers:request"
  | "transfers:approve"
  | "bookings:manage"
  | "maintenance:request"
  | "maintenance:manage"
  | "audits:manage"
  | "audits:execute"
  | "reports:read"
  | "logs:read";
export const rolePermissions: Record<RoleName, readonly Permission[]> = {
  ADMIN: [
    "org:manage",
    "roles:manage",
    "assets:read",
    "assets:write",
    "allocations:manage",
    "transfers:request",
    "transfers:approve",
    "bookings:manage",
    "maintenance:request",
    "maintenance:manage",
    "audits:manage",
    "reports:read",
    "logs:read",
  ],
  ASSET_MANAGER: [
    "assets:read",
    "assets:write",
    "allocations:manage",
    "transfers:request",
    "transfers:approve",
    "bookings:manage",
    "maintenance:request",
    "maintenance:manage",
    "reports:read",
    "logs:read",
  ],
  DEPARTMENT_HEAD: [
    "assets:read",
    "transfers:request",
    "transfers:approve",
    "bookings:manage",
    "maintenance:request",
    "reports:read",
  ],
  EMPLOYEE: [
    "assets:read",
    "transfers:request",
    "bookings:manage",
    "maintenance:request",
  ],
  AUDITOR: ["assets:read", "audits:execute"],
};
export const hasPermission = (roles: RoleName[], permission: Permission) =>
  roles.some((r) => rolePermissions[r].includes(permission));
