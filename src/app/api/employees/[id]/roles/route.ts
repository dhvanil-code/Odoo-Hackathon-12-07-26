import { z } from "zod";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const schema = z.object({
  role: z.enum(["ASSET_MANAGER", "DEPARTMENT_HEAD", "AUDITOR"]),
  action: z.enum(["ASSIGN", "REMOVE"]),
  reason: z.string().min(5).max(1000),
});
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor("roles:manage");
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const employee = await db.employee.findUniqueOrThrow({
      where: { id },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    const role = await db.role.findUniqueOrThrow({
      where: { name: input.role },
    });
    const previous = employee.user.roles.map((entry) => entry.role.name);
    await db.$transaction(async (tx) => {
      if (input.action === "ASSIGN")
        await tx.userRole.upsert({
          where: {
            userId_roleId: { userId: employee.userId, roleId: role.id },
          },
          update: {
            assignedById: actor.userId,
            reason: input.reason,
            assignedAt: new Date(),
          },
          create: {
            userId: employee.userId,
            roleId: role.id,
            assignedById: actor.userId,
            reason: input.reason,
          },
        });
      else
        await tx.userRole.deleteMany({
          where: { userId: employee.userId, roleId: role.id },
        });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "ROLE_CHANGED",
          entityType: "Employee",
          entityId: id,
          oldValues: { roles: previous },
          newValues: { role: input.role, action: input.action },
          reason: input.reason,
        },
      });
      await tx.notification.create({
        data: {
          recipientId: id,
          type: "ROLE_CHANGED",
          title: "Your access changed",
          message: `${input.role} was ${input.action.toLowerCase()}ed.`,
          severity: "INFO",
          relatedType: "Employee",
          relatedId: id,
        },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
