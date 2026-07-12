import type { AssetCondition, Prisma, RoleName } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError, databaseError } from "@/lib/errors";
import { assertTransition } from "@/modules/assets/lifecycle";
type Actor = {
  userId: string;
  employeeId: string;
  roles: RoleName[];
  departmentId: string | null;
};
const canManage = (a: Actor) =>
  a.roles.includes("ADMIN") || a.roles.includes("ASSET_MANAGER");
async function history(
  tx: Prisma.TransactionClient,
  assetId: string,
  from: import("@prisma/client").AssetStatus,
  to: import("@prisma/client").AssetStatus,
  actor: Actor,
  reason: string,
  relatedType: string,
  relatedId: string,
) {
  assertTransition(from, to);
  await tx.assetHistory.create({
    data: {
      assetId,
      previousStatus: from,
      newStatus: to,
      actorId: actor.userId,
      reason,
      relatedType,
      relatedId,
    },
  });
  await tx.activityLog.create({
    data: {
      actorId: actor.userId,
      action: "ASSET_STATUS_CHANGED",
      entityType: "Asset",
      entityId: assetId,
      oldValues: { status: from },
      newValues: { status: to },
      reason,
    },
  });
}
export async function allocate(
  input: {
    assetId: string;
    employeeId?: string;
    departmentId?: string;
    purpose: string;
    condition: AssetCondition;
    expectedReturnDate?: Date;
  },
  actor: Actor,
) {
  if (!canManage(actor))
    throw new DomainError("FORBIDDEN", "Asset Manager permission is required.");
  try {
    return await db.$transaction(
      async (tx) => {
        const asset = await tx.asset.findUniqueOrThrow({
          where: { id: input.assetId },
        });
        const active = await tx.allocation.findFirst({
          where: {
            assetId: input.assetId,
            status: "ACTIVE",
            actualReturnDate: null,
          },
          include: {
            employee: { include: { department: true } },
            department: true,
          },
        });
        if (active)
          throw new DomainError(
            "ASSET_ALREADY_ALLOCATED",
            "This asset is already allocated.",
            {
              currentHolder: {
                name: active.employee?.name ?? active.department?.name,
                department: active.employee?.department?.name,
              },
              allowedAction: "CREATE_TRANSFER_REQUEST",
            },
          );
        if (asset.status !== "AVAILABLE")
          throw new DomainError(
            "ASSET_UNAVAILABLE",
            `Asset is ${asset.status}.`,
          );
        if (Boolean(input.employeeId) === Boolean(input.departmentId))
          throw new DomainError(
            "INVALID_HOLDER",
            "Select exactly one employee or department.",
          );
        if (input.employeeId) {
          const employee = await tx.employee.findUniqueOrThrow({
            where: { id: input.employeeId },
          });
          if (employee.status !== "ACTIVE")
            throw new DomainError(
              "INACTIVE_HOLDER",
              "Inactive employees cannot receive assets.",
            );
        }
        if (input.departmentId) {
          const dept = await tx.department.findUniqueOrThrow({
            where: { id: input.departmentId },
          });
          if (dept.status !== "ACTIVE")
            throw new DomainError(
              "INACTIVE_HOLDER",
              "Inactive departments cannot receive assets.",
            );
        }
        const allocation = await tx.allocation.create({
          data: {
            assetId: input.assetId,
            employeeId: input.employeeId,
            departmentId: input.departmentId,
            purpose: input.purpose,
            expectedReturnDate: input.expectedReturnDate,
            conditionAtIssue: input.condition,
            allocationDate: new Date(),
          },
        });
        await tx.asset.update({
          where: { id: asset.id },
          data: { status: "ALLOCATED" },
        });
        await history(
          tx,
          asset.id,
          asset.status,
          "ALLOCATED",
          actor,
          input.purpose,
          "Allocation",
          allocation.id,
        );
        return allocation;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof DomainError) throw e;
    databaseError(e);
  }
}
export async function book(
  input: {
    resourceId: string;
    startTime: Date;
    endTime: Date;
    purpose: string;
    attendeeCount?: number;
  },
  actor: Actor,
) {
  if (input.startTime >= input.endTime)
    throw new DomainError("INVALID_TIME_RANGE", "Start must be before end.");
  try {
    return await db.$transaction(
      async (tx) => {
        const resource = await tx.asset.findUniqueOrThrow({
          where: { id: input.resourceId },
        });
        if (
          !resource.shared ||
          ["UNDER_MAINTENANCE", "LOST", "RETIRED", "DISPOSED"].includes(
            resource.status,
          )
        )
          throw new DomainError(
            "RESOURCE_UNAVAILABLE",
            "This resource cannot be booked.",
          );
        const conflict = await tx.resourceBooking.findFirst({
          where: {
            resourceId: input.resourceId,
            status: { in: ["UPCOMING", "ONGOING"] },
            startTime: { lt: input.endTime },
            endTime: { gt: input.startTime },
          },
        });
        if (conflict)
          throw new DomainError(
            "BOOKING_CONFLICT",
            "The resource is already booked in this time range.",
            {
              conflict: { start: conflict.startTime, end: conflict.endTime },
              suggestedSlot: {
                start: conflict.endTime,
                end: new Date(
                  conflict.endTime.getTime() +
                    (input.endTime.getTime() - input.startTime.getTime()),
                ),
              },
            },
          );
        const booking = await tx.resourceBooking.create({
          data: {
            ...input,
            bookedById: actor.employeeId,
            departmentId: actor.departmentId,
            status: "UPCOMING",
          },
        });
        await tx.activityLog.create({
          data: {
            actorId: actor.userId,
            action: "BOOKING_CREATED",
            entityType: "ResourceBooking",
            entityId: booking.id,
            newValues: { startTime: input.startTime, endTime: input.endTime },
          },
        });
        return booking;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof DomainError) throw e;
    databaseError(e);
  }
}
export async function approveMaintenance(id: string, actor: Actor) {
  if (!canManage(actor))
    throw new DomainError(
      "FORBIDDEN",
      "Maintenance approval permission is required.",
    );
  return db.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.findUniqueOrThrow({
      where: { id },
      include: { asset: true },
    });
    if (request.status !== "PENDING")
      throw new DomainError(
        "INVALID_MAINTENANCE_STATE",
        "Only pending requests can be approved.",
      );
    assertTransition(request.asset.status, "UNDER_MAINTENANCE");
    await tx.maintenanceRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    await tx.asset.update({
      where: { id: request.assetId },
      data: { status: "UNDER_MAINTENANCE" },
    });
    await history(
      tx,
      request.assetId,
      request.asset.status,
      "UNDER_MAINTENANCE",
      actor,
      "Maintenance approved",
      "MaintenanceRequest",
      id,
    );
  });
}
