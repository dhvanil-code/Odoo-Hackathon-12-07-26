import { z } from "zod";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
const schema = z
  .object({ id: z.uuid().optional(), all: z.boolean().optional() })
  .refine(
    (value) => Boolean(value.id) !== Boolean(value.all),
    "Choose one notification or all.",
  );
export async function PATCH(request: Request) {
  try {
    const actor = await requireActor();
    const input = schema.parse(await request.json());
    const where = input.all
      ? { recipientId: actor.employeeId, readAt: null }
      : { id: input.id, recipientId: actor.employeeId };
    const result = await db.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
