import { z } from "zod";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
const schema = z.object({
  departmentId: z.uuid().nullable().optional(),
  managerId: z.uuid().nullable().optional(),
  phone: z.string().max(50).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  reason: z.string().min(5).max(1000).optional(),
});
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor("org:manage");
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    if (input.status === "INACTIVE" && id === actor.employeeId)
      throw new DomainError(
        "FORBIDDEN",
        "You cannot deactivate your own account.",
      );
    const { reason, ...changes } = input;
    const old = await db.employee.findUniqueOrThrow({ where: { id } });
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.employee.update({ where: { id }, data: changes });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: input.status
            ? `EMPLOYEE_${input.status}`
            : "EMPLOYEE_UPDATED",
          entityType: "Employee",
          entityId: id,
          oldValues: old,
          newValues: input,
          reason,
        },
      });
      return result;
    });
    return Response.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
