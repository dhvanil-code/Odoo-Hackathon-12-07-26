import { z } from "zod";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/http";
import { assertTransition } from "@/modules/assets/lifecycle";
const schema = z.object({
  name: z.string().min(2).max(200).optional(),
  serialNumber: z.string().max(200).nullable().optional(),
  locationId: z.uuid().optional(),
  owningDepartmentId: z.uuid().nullable().optional(),
  condition: z
    .enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"])
    .optional(),
  manufacturer: z.string().max(200).nullable().optional(),
  model: z.string().max(200).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(["AVAILABLE", "LOST", "RETIRED", "DISPOSED"]).optional(),
  reason: z.string().min(5).max(1000),
});
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor("assets:write");
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const asset = await db.asset.findUniqueOrThrow({ where: { id } });
    if (input.status) {
      if (
        !actor.roles.includes("ADMIN") &&
        !actor.roles.includes("ASSET_MANAGER")
      )
        throw new DomainError(
          "FORBIDDEN",
          "Lifecycle management permission is required.",
        );
      assertTransition(
        asset.status,
        input.status,
        actor.roles.includes("ADMIN"),
      );
    }
    const updated = await db.$transaction(async (tx) => {
      const result = await tx.asset.update({
        where: { id },
        data: {
          name: input.name,
          serialNumber: input.serialNumber,
          locationId: input.locationId,
          owningDepartmentId: input.owningDepartmentId,
          condition: input.condition,
          manufacturer: input.manufacturer,
          model: input.model,
          notes: input.notes,
          status: input.status,
        },
      });
      if (input.status && input.status !== asset.status)
        await tx.assetHistory.create({
          data: {
            assetId: id,
            previousStatus: asset.status,
            newStatus: input.status,
            actorId: actor.userId,
            reason: input.reason,
            relatedType: "Asset",
            relatedId: id,
          },
        });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: input.status ? "ASSET_STATUS_CHANGED" : "ASSET_UPDATED",
          entityType: "Asset",
          entityId: id,
          oldValues: { status: asset.status },
          newValues: { status: result.status },
          reason: input.reason,
        },
      });
      return result;
    });
    return Response.json(updated);
  } catch (error) {
    return jsonError(error);
  }
}
