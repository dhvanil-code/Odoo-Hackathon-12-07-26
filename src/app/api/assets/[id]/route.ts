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
const deleteSchema = z.object({ reason: z.string().min(5).max(1000) });
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor("assets:write");
    const { id } = await context.params;
    const input = deleteSchema.parse(await request.json());
    const asset = await db.asset.findUniqueOrThrow({ where: { id } });
    const activeAllocation = await db.allocation.findFirst({
      where: { assetId: id, status: "ACTIVE", actualReturnDate: null },
    });
    if (activeAllocation)
      throw new DomainError(
        "ASSET_IN_CUSTODY",
        "Return or transfer this asset before deleting it.",
      );
    const activeMaintenance = await db.maintenanceRequest.findFirst({
      where: {
        assetId: id,
        status: {
          in: ["PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"],
        },
      },
    });
    if (activeMaintenance)
      throw new DomainError(
        "MAINTENANCE_ALREADY_ACTIVE",
        "Resolve the active maintenance request before deleting this asset.",
      );
    if (asset.status === "DISPOSED")
      throw new DomainError(
        "ASSET_ALREADY_DELETED",
        "This asset is already deleted.",
      );
    const result = await db.$transaction(async (tx) => {
      let previousStatus = asset.status;
      if (asset.status !== "RETIRED") {
        assertTransition(
          asset.status,
          "RETIRED",
          actor.roles.includes("ADMIN"),
        );
        await tx.asset.update({ where: { id }, data: { status: "RETIRED" } });
        await tx.assetHistory.create({
          data: {
            assetId: id,
            previousStatus,
            newStatus: "RETIRED",
            actorId: actor.userId,
            reason: input.reason,
            relatedType: "Asset",
            relatedId: id,
          },
        });
        previousStatus = "RETIRED";
      }
      const deleted = await tx.asset.update({
        where: { id },
        data: { status: "DISPOSED" },
      });
      await tx.assetHistory.create({
        data: {
          assetId: id,
          previousStatus,
          newStatus: "DISPOSED",
          actorId: actor.userId,
          reason: input.reason,
          relatedType: "Asset",
          relatedId: id,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "ASSET_DELETED",
          entityType: "Asset",
          entityId: id,
          oldValues: { status: asset.status },
          newValues: { status: "DISPOSED" },
          reason: input.reason,
        },
      });
      return deleted;
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
