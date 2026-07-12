import type { RoleName } from "@prisma/client";
import { auth } from "@/auth";
import { hasPermission, type Permission } from "@/auth/permissions";
import { DomainError } from "@/lib/errors";
import { db } from "@/lib/db";
export { assertDepartmentScope, isOrganizationWide } from "@/auth/scope";

export type Actor = {
  userId: string;
  employeeId: string;
  roles: RoleName[];
  departmentId: string | null;
};

export async function requireActor(permission?: Permission): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id || !session.user.employeeId) {
    throw new DomainError("UNAUTHENTICATED", "Sign in is required.");
  }
  const actor: Actor = {
    userId: session.user.id,
    employeeId: session.user.employeeId,
    roles: session.user.roles,
    departmentId: session.user.departmentId,
  };
  const active = await db.employee.count({
    where: { id: actor.employeeId, userId: actor.userId, status: "ACTIVE" },
  });
  if (!active)
    throw new DomainError("UNAUTHENTICATED", "This account is inactive.");
  if (permission && !hasPermission(actor.roles, permission)) {
    throw new DomainError(
      "FORBIDDEN",
      "You do not have permission for this action.",
    );
  }
  return actor;
}
