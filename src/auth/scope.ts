import type { Actor } from "@/auth/access";
import { DomainError } from "@/lib/errors";
export function isOrganizationWide(actor: Actor) {
  return actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
}
export function assertDepartmentScope(
  actor: Actor,
  departmentId: string | null | undefined,
) {
  if (isOrganizationWide(actor)) return;
  if (!actor.departmentId || actor.departmentId !== departmentId)
    throw new DomainError(
      "FORBIDDEN_SCOPE",
      "This record belongs to another department.",
    );
}
