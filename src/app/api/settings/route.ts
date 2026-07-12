import { z } from "zod";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
const schema = z.object({
  timezone: z.string().min(3).max(100),
  overdueEscalationDays: z.string().regex(/^\d+(,\s*\d+)*$/),
  maintenanceSlaHours: z.coerce.number().int().positive().max(10000),
});
export async function PATCH(request: Request) {
  try {
    const actor = await requireActor("org:manage");
    const input = schema.parse(await request.json());
    await db.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(input))
        await tx.organizationSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "SETTINGS_UPDATED",
          entityType: "OrganizationSetting",
          newValues: input,
        },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
