import type { AssetCondition, Prisma } from "@prisma/client";
import type { Actor } from "@/auth/access";
import { assertDepartmentScope, isOrganizationWide } from "@/auth/scope";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { assertTransition } from "@/modules/assets/lifecycle";

const manager = (actor: Actor) =>
  actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
async function log(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  type: string,
  id: string,
  reason?: string,
  values?: Prisma.InputJsonValue,
) {
  await tx.activityLog.create({
    data: {
      actorId: actor.userId,
      action,
      entityType: type,
      entityId: id,
      reason,
      newValues: values,
    },
  });
}
async function notify(
  tx: Prisma.TransactionClient,
  recipientId: string | null | undefined,
  type: string,
  title: string,
  message: string,
  relatedId: string,
  severity: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
) {
  if (!recipientId) return;
  await tx.notification.create({
    data: {
      recipientId,
      type,
      title,
      message,
      relatedType: type,
      relatedId,
      severity,
    },
  });
}

export async function requestTransfer(
  input: {
    assetId: string;
    proposedHolderId: string;
    reason: string;
    requiredBy?: Date;
    notes?: string;
  },
  actor: Actor,
) {
  return db.$transaction(
    async (tx) => {
      const allocation = await tx.allocation.findFirst({
        where: {
          assetId: input.assetId,
          status: "ACTIVE",
          actualReturnDate: null,
        },
        include: { employee: true, asset: true },
      });
      if (!allocation)
        throw new DomainError(
          "NO_ACTIVE_ALLOCATION",
          "An active allocation is required.",
        );
      if (
        !isOrganizationWide(actor) &&
        allocation.employeeId !== actor.employeeId
      )
        assertDepartmentScope(actor, allocation.employee?.departmentId);
      const proposed = await tx.employee.findUniqueOrThrow({
        where: { id: input.proposedHolderId },
      });
      if (proposed.status !== "ACTIVE")
        throw new DomainError(
          "INACTIVE_HOLDER",
          "The proposed holder is inactive.",
        );
      if (allocation.employeeId === proposed.id)
        throw new DomainError(
          "SAME_TRANSFER_HOLDER",
          "Choose a different proposed holder.",
        );
      const duplicate = await tx.transferRequest.findFirst({
        where: {
          assetId: input.assetId,
          status: { in: ["REQUESTED", "APPROVED"] },
        },
      });
      if (duplicate)
        throw new DomainError(
          "TRANSFER_ALREADY_PENDING",
          "A transfer is already pending for this asset.",
        );
      const transfer = await tx.transferRequest.create({
        data: { ...input, requesterId: actor.employeeId },
      });
      await log(
        tx,
        actor,
        "TRANSFER_REQUESTED",
        "TransferRequest",
        transfer.id,
        input.reason,
      );
      return transfer;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function decideTransfer(
  id: string,
  decision: "APPROVED" | "REJECTED",
  notes: string | undefined,
  actor: Actor,
) {
  if (!manager(actor) && !actor.roles.includes("DEPARTMENT_HEAD"))
    throw new DomainError(
      "FORBIDDEN",
      "Transfer approval permission is required.",
    );
  return db.$transaction(async (tx) => {
    const transfer = await tx.transferRequest.findUniqueOrThrow({
      where: { id },
      include: {
        asset: {
          include: {
            allocations: {
              where: { status: "ACTIVE" },
              include: { employee: true },
            },
          },
        },
      },
    });
    if (transfer.status !== "REQUESTED")
      throw new DomainError(
        "INVALID_TRANSFER_STATE",
        "Only requested transfers can be decided.",
      );
    if (transfer.requesterId === actor.employeeId)
      throw new DomainError(
        "SELF_APPROVAL_FORBIDDEN",
        "Requesters cannot approve their own transfer.",
      );
    if (!manager(actor))
      assertDepartmentScope(
        actor,
        transfer.asset.allocations[0]?.employee?.departmentId,
      );
    await tx.transferApproval.create({
      data: { transferId: id, approverId: actor.employeeId, decision, notes },
    });
    const updated = await tx.transferRequest.update({
      where: { id },
      data: {
        status: decision,
        approvedById: actor.employeeId,
        approvedAt: decision === "APPROVED" ? new Date() : null,
        notes,
      },
    });
    await log(tx, actor, `TRANSFER_${decision}`, "TransferRequest", id, notes);
    await notify(
      tx,
      transfer.requesterId,
      `TRANSFER_${decision}`,
      `Transfer ${decision.toLowerCase()}`,
      `${transfer.asset.tag} was ${decision.toLowerCase()}.`,
      id,
      decision === "REJECTED" ? "WARNING" : "SUCCESS",
    );
    return updated;
  });
}

export async function completeTransfer(
  id: string,
  input: { condition: AssetCondition; accessories?: string; notes?: string },
  actor: Actor,
) {
  if (!manager(actor))
    throw new DomainError("FORBIDDEN", "Asset Manager permission is required.");
  return db.$transaction(
    async (tx) => {
      const transfer = await tx.transferRequest.findUniqueOrThrow({
        where: { id },
        include: { asset: true, proposedHolder: true },
      });
      if (transfer.status !== "APPROVED")
        throw new DomainError(
          "INVALID_TRANSFER_STATE",
          "The transfer must be approved first.",
        );
      const maintenance = await tx.maintenanceRequest.findFirst({
        where: {
          assetId: transfer.assetId,
          status: { in: ["APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"] },
        },
      });
      if (maintenance)
        throw new DomainError(
          "MAINTENANCE_CONFLICT",
          "Transfer cannot complete during maintenance.",
        );
      const current = await tx.allocation.findFirst({
        where: {
          assetId: transfer.assetId,
          status: "ACTIVE",
          actualReturnDate: null,
        },
      });
      if (!current)
        throw new DomainError(
          "NO_ACTIVE_ALLOCATION",
          "The original allocation no longer exists.",
        );
      const now = new Date();
      await tx.allocation.update({
        where: { id: current.id },
        data: { status: "TRANSFERRED", actualReturnDate: now },
      });
      const next = await tx.allocation.create({
        data: {
          assetId: transfer.assetId,
          employeeId: transfer.proposedHolderId,
          departmentId: transfer.proposedHolder.departmentId,
          purpose: transfer.reason,
          conditionAtIssue: input.condition,
          accessories: input.accessories,
          notes: input.notes,
          allocationDate: now,
        },
      });
      await tx.transferRequest.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: now },
      });
      await tx.assetHistory.create({
        data: {
          assetId: transfer.assetId,
          previousStatus: "ALLOCATED",
          newStatus: "ALLOCATED",
          actorId: actor.userId,
          reason: "Transfer handover completed",
          relatedType: "TransferRequest",
          relatedId: id,
        },
      });
      await log(
        tx,
        actor,
        "TRANSFER_COMPLETED",
        "TransferRequest",
        id,
        input.notes,
        { oldAllocationId: current.id, newAllocationId: next.id },
      );
      await notify(
        tx,
        transfer.proposedHolderId,
        "TRANSFER_COMPLETED",
        "Asset handed over",
        `${transfer.asset.tag} is now assigned to you.`,
        id,
        "SUCCESS",
      );
      return next;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function requestReturn(
  input: {
    assetId: string;
    proposedReturnDate?: Date;
    reportedCondition: AssetCondition;
    conditionNotes?: string;
    accessoriesReturned?: string;
  },
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const allocation = await tx.allocation.findFirst({
      where: {
        assetId: input.assetId,
        status: "ACTIVE",
        actualReturnDate: null,
      },
    });
    if (
      !allocation ||
      (!manager(actor) && allocation.employeeId !== actor.employeeId)
    )
      throw new DomainError(
        "RETURN_NOT_ALLOWED",
        "You do not hold an active allocation for this asset.",
      );
    const duplicate = await tx.returnRequest.findFirst({
      where: {
        assetId: input.assetId,
        status: { in: ["REQUESTED", "INSPECTION"] },
      },
    });
    if (duplicate)
      throw new DomainError(
        "RETURN_ALREADY_PENDING",
        "A return is already pending.",
      );
    const request = await tx.returnRequest.create({
      data: {
        ...input,
        allocationId: allocation.id,
        employeeId: allocation.employeeId ?? actor.employeeId,
      },
    });
    await log(
      tx,
      actor,
      "RETURN_REQUESTED",
      "ReturnRequest",
      request.id,
      input.conditionNotes,
    );
    return request;
  });
}

export async function acceptReturn(
  id: string,
  input: {
    verifiedCondition: AssetCondition;
    conditionNotes?: string;
    missingAccessories?: string;
    newLocationId: string;
    acceptDiscrepancy?: boolean;
  },
  actor: Actor,
) {
  if (!manager(actor))
    throw new DomainError("FORBIDDEN", "Asset Manager permission is required.");
  return db.$transaction(
    async (tx) => {
      const request = await tx.returnRequest.findUniqueOrThrow({
        where: { id },
        include: { asset: true, allocation: true },
      });
      if (request.status === "ACCEPTED")
        throw new DomainError(
          "RETURN_ALREADY_COMPLETED",
          "This return was already completed.",
        );
      if (input.missingAccessories && !input.acceptDiscrepancy)
        throw new DomainError(
          "ACCESSORY_DISCREPANCY",
          "Resolve or explicitly accept the missing-accessory discrepancy.",
        );
      const damaged = ["DAMAGED", "UNUSABLE"].includes(input.verifiedCondition);
      const now = new Date();
      await tx.allocation.update({
        where: { id: request.allocationId },
        data: { status: "RETURNED", actualReturnDate: now, overdue: false },
      });
      await tx.returnRequest.update({
        where: { id },
        data: { ...input, status: "ACCEPTED", actualReturnDate: now },
      });
      const nextStatus = damaged ? "UNDER_MAINTENANCE" : "AVAILABLE";
      assertTransition(request.asset.status, nextStatus);
      await tx.asset.update({
        where: { id: request.assetId },
        data: {
          status: nextStatus,
          condition: input.verifiedCondition,
          locationId: input.newLocationId,
        },
      });
      if (damaged)
        await tx.maintenanceRequest.create({
          data: {
            assetId: request.assetId,
            raisedById: request.employeeId,
            issueDescription:
              input.conditionNotes || "Damage found during return inspection",
            priority: "HIGH",
            status: "APPROVED",
            approvalNotes: "Automatically approved from damaged return",
          },
        });
      await tx.assetHistory.create({
        data: {
          assetId: request.assetId,
          previousStatus: request.asset.status,
          newStatus: nextStatus,
          actorId: actor.userId,
          reason: damaged ? "Damaged return accepted" : "Return accepted",
          relatedType: "ReturnRequest",
          relatedId: id,
        },
      });
      await log(
        tx,
        actor,
        "RETURN_ACCEPTED",
        "ReturnRequest",
        id,
        input.conditionNotes,
      );
      await notify(
        tx,
        request.employeeId,
        "RETURN_ACCEPTED",
        "Return accepted",
        `${request.asset.tag} was inspected and accepted.`,
        id,
        damaged ? "WARNING" : "SUCCESS",
      );
    },
    { isolationLevel: "Serializable" },
  );
}

export async function raiseMaintenance(
  input: {
    assetId: string;
    issueDescription: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  },
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const asset = await tx.asset.findUniqueOrThrow({
      where: { id: input.assetId },
      include: { allocations: { where: { status: "ACTIVE" }, take: 1 } },
    });
    if (
      !manager(actor) &&
      asset.allocations[0]?.employeeId !== actor.employeeId
    )
      throw new DomainError(
        "FORBIDDEN_SCOPE",
        "Maintenance can only be raised for an assigned asset.",
      );
    const active = await tx.maintenanceRequest.findFirst({
      where: {
        assetId: input.assetId,
        status: {
          in: ["PENDING", "APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"],
        },
      },
    });
    if (active)
      throw new DomainError(
        "MAINTENANCE_ALREADY_ACTIVE",
        "An active maintenance request already exists.",
      );
    const request = await tx.maintenanceRequest.create({
      data: { ...input, raisedById: actor.employeeId, status: "PENDING" },
    });
    await log(
      tx,
      actor,
      "MAINTENANCE_REQUESTED",
      "MaintenanceRequest",
      request.id,
      input.issueDescription,
    );
    return request;
  });
}

export async function cancelBooking(id: string, actor: Actor) {
  return db.$transaction(async (tx) => {
    const booking = await tx.resourceBooking.findUniqueOrThrow({
      where: { id },
    });
    if (
      !manager(actor) &&
      booking.bookedById !== actor.employeeId &&
      !(
        actor.roles.includes("DEPARTMENT_HEAD") &&
        booking.departmentId === actor.departmentId
      )
    )
      throw new DomainError(
        "FORBIDDEN_SCOPE",
        "You cannot cancel this booking.",
      );
    if (!["UPCOMING", "ONGOING"].includes(booking.status))
      throw new DomainError(
        "INVALID_BOOKING_STATE",
        "Only active bookings can be cancelled.",
      );
    const updated = await tx.resourceBooking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await log(tx, actor, "BOOKING_CANCELLED", "ResourceBooking", id);
    await notify(
      tx,
      booking.bookedById,
      "BOOKING_CANCELLED",
      "Booking cancelled",
      "Your resource booking was cancelled.",
      id,
      "WARNING",
    );
    return updated;
  });
}

export async function rescheduleBooking(
  id: string,
  startTime: Date,
  endTime: Date,
  actor: Actor,
) {
  if (startTime >= endTime)
    throw new DomainError("INVALID_TIME_RANGE", "Start must be before end.");
  return db.$transaction(
    async (tx) => {
      const booking = await tx.resourceBooking.findUniqueOrThrow({
        where: { id },
      });
      if (
        !manager(actor) &&
        booking.bookedById !== actor.employeeId &&
        !(
          actor.roles.includes("DEPARTMENT_HEAD") &&
          booking.departmentId === actor.departmentId
        )
      )
        throw new DomainError(
          "FORBIDDEN_SCOPE",
          "You cannot reschedule this booking.",
        );
      if (booking.status !== "UPCOMING")
        throw new DomainError(
          "INVALID_BOOKING_STATE",
          "Only upcoming bookings can be rescheduled.",
        );
      const conflict = await tx.resourceBooking.findFirst({
        where: {
          id: { not: id },
          resourceId: booking.resourceId,
          status: { in: ["UPCOMING", "ONGOING"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflict)
        throw new DomainError(
          "BOOKING_CONFLICT",
          "The new time overlaps an active booking.",
          { start: conflict.startTime, end: conflict.endTime },
        );
      const updated = await tx.resourceBooking.update({
        where: { id },
        data: { startTime, endTime },
      });
      await log(
        tx,
        actor,
        "BOOKING_RESCHEDULED",
        "ResourceBooking",
        id,
        undefined,
        { startTime: startTime.toISOString(), endTime: endTime.toISOString() },
      );
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function transitionMaintenance(
  id: string,
  input: {
    action: "APPROVE" | "REJECT" | "ASSIGN" | "START" | "RESOLVE";
    notes?: string;
    technicianId?: string;
    finalCondition?: AssetCondition;
    operationalCost?: number;
  },
  actor: Actor,
) {
  if (!manager(actor))
    throw new DomainError(
      "FORBIDDEN",
      "Maintenance management permission is required.",
    );
  return db.$transaction(async (tx) => {
    const request = await tx.maintenanceRequest.findUniqueOrThrow({
      where: { id },
      include: { asset: true },
    });
    const map = {
      APPROVE: { from: ["PENDING"], to: "APPROVED" },
      REJECT: { from: ["PENDING"], to: "REJECTED" },
      ASSIGN: { from: ["APPROVED"], to: "TECHNICIAN_ASSIGNED" },
      START: { from: ["APPROVED", "TECHNICIAN_ASSIGNED"], to: "IN_PROGRESS" },
      RESOLVE: {
        from: ["APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"],
        to: "RESOLVED",
      },
    } as const;
    const rule = map[input.action];
    if (!(rule.from as readonly string[]).includes(request.status))
      throw new DomainError(
        "INVALID_MAINTENANCE_STATE",
        `${input.action} is not valid from ${request.status}.`,
      );
    if (input.action === "ASSIGN" && !input.technicianId)
      throw new DomainError("TECHNICIAN_REQUIRED", "Select a technician.");
    if (input.action === "APPROVE") {
      assertTransition(request.asset.status, "UNDER_MAINTENANCE");
      await tx.asset.update({
        where: { id: request.assetId },
        data: { status: "UNDER_MAINTENANCE" },
      });
      await tx.assetHistory.create({
        data: {
          assetId: request.assetId,
          previousStatus: request.asset.status,
          newStatus: "UNDER_MAINTENANCE",
          actorId: actor.userId,
          reason: "Maintenance approved",
          relatedType: "MaintenanceRequest",
          relatedId: id,
        },
      });
    }
    if (input.action === "RESOLVE") {
      if (!input.finalCondition)
        throw new DomainError(
          "FINAL_CONDITION_REQUIRED",
          "Final condition is required.",
        );
      const activeAllocation = await tx.allocation.findFirst({
        where: {
          assetId: request.assetId,
          status: "ACTIVE",
          actualReturnDate: null,
        },
      });
      const restoredStatus = activeAllocation ? "ALLOCATED" : "AVAILABLE";
      assertTransition(request.asset.status, restoredStatus);
      await tx.asset.update({
        where: { id: request.assetId },
        data: { status: restoredStatus, condition: input.finalCondition },
      });
      await tx.assetHistory.create({
        data: {
          assetId: request.assetId,
          previousStatus: request.asset.status,
          newStatus: restoredStatus,
          actorId: actor.userId,
          reason: "Maintenance resolved",
          relatedType: "MaintenanceRequest",
          relatedId: id,
        },
      });
    }
    const updated = await tx.maintenanceRequest.update({
      where: { id },
      data: {
        status: rule.to,
        technicianId: input.technicianId,
        approvalNotes: input.action === "APPROVE" ? input.notes : undefined,
        rejectionReason: input.action === "REJECT" ? input.notes : undefined,
        resolutionNotes: input.action === "RESOLVE" ? input.notes : undefined,
        finalCondition: input.finalCondition,
        operationalCost: input.operationalCost,
        completionDate: input.action === "RESOLVE" ? new Date() : undefined,
      },
    });
    await log(
      tx,
      actor,
      `MAINTENANCE_${input.action}`,
      "MaintenanceRequest",
      id,
      input.notes,
    );
    await notify(
      tx,
      request.raisedById,
      `MAINTENANCE_${input.action}`,
      `Maintenance ${input.action.toLowerCase()}`,
      `${request.asset.tag} maintenance was updated.`,
      id,
      input.action === "REJECT" ? "WARNING" : "INFO",
    );
    return updated;
  });
}

export async function startAudit(id: string, actor: Actor) {
  if (!actor.roles.includes("ADMIN"))
    throw new DomainError("FORBIDDEN", "Admin permission is required.");
  return db.$transaction(async (tx) => {
    const audit = await tx.auditCycle.findUniqueOrThrow({ where: { id } });
    if (!["DRAFT", "SCHEDULED"].includes(audit.status))
      throw new DomainError(
        "INVALID_AUDIT_STATE",
        "Only draft or scheduled audits can start.",
      );
    const assets = await tx.asset.findMany({
      where: {
        ...(audit.departmentId
          ? { owningDepartmentId: audit.departmentId }
          : {}),
        ...(audit.locationId ? { locationId: audit.locationId } : {}),
      },
      include: {
        location: true,
        allocations: {
          where: { status: "ACTIVE" },
          include: { employee: true },
          take: 1,
        },
      },
    });
    for (const asset of assets)
      await tx.auditLine.upsert({
        where: { auditId_assetId: { auditId: id, assetId: asset.id } },
        update: {},
        create: {
          auditId: id,
          assetId: asset.id,
          expectedHolder: asset.allocations[0]?.employee?.name,
          expectedLocation: asset.location.name,
          expectedStatus: asset.status,
          expectedCondition: asset.condition,
        },
      });
    const updated = await tx.auditCycle.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });
    await log(tx, actor, "AUDIT_STARTED", "AuditCycle", id, undefined, {
      assetCount: assets.length,
    });
    return updated;
  });
}

export async function verifyAuditLine(
  id: string,
  input: {
    result: "VERIFIED" | "MISSING" | "DAMAGED";
    actualLocation?: string;
    actualHolder?: string;
    notes?: string;
  },
  actor: Actor,
) {
  if (!actor.roles.includes("AUDITOR") && !actor.roles.includes("ADMIN"))
    throw new DomainError("FORBIDDEN", "Auditor permission is required.");
  return db.$transaction(async (tx) => {
    const line = await tx.auditLine.findUniqueOrThrow({
      where: { id },
      include: { audit: { include: { assignments: true } } },
    });
    if (line.audit.status === "CLOSED")
      throw new DomainError("AUDIT_LOCKED", "Closed audits are immutable.");
    if (
      !actor.roles.includes("ADMIN") &&
      !line.audit.assignments.some((a) => a.auditorId === actor.employeeId)
    )
      throw new DomainError(
        "FORBIDDEN_SCOPE",
        "This audit is not assigned to you.",
      );
    const updated = await tx.auditLine.update({
      where: { id },
      data: { ...input, auditorId: actor.employeeId, verifiedAt: new Date() },
    });
    if (input.result !== "VERIFIED")
      await tx.auditDiscrepancy.upsert({
        where: { auditLineId: id },
        update: { reason: input.notes || input.result, status: "OPEN" },
        create: { auditLineId: id, reason: input.notes || input.result },
      });
    await log(tx, actor, "AUDIT_LINE_VERIFIED", "AuditLine", id, input.notes, {
      result: input.result,
    });
    return updated;
  });
}

export async function closeAudit(
  id: string,
  confirmMissing: boolean,
  actor: Actor,
) {
  if (!actor.roles.includes("ADMIN"))
    throw new DomainError("FORBIDDEN", "Admin permission is required.");
  return db.$transaction(async (tx) => {
    const audit = await tx.auditCycle.findUniqueOrThrow({
      where: { id },
      include: { lines: { include: { asset: true, discrepancy: true } } },
    });
    if (!["IN_PROGRESS", "REVIEW"].includes(audit.status))
      throw new DomainError(
        "INVALID_AUDIT_STATE",
        "Audit must be in progress or review.",
      );
    if (audit.lines.some((line) => line.result === "PENDING"))
      throw new DomainError(
        "AUDIT_INCOMPLETE",
        "Every audit line must be verified.",
      );
    if (confirmMissing)
      for (const line of audit.lines.filter(
        (item) => item.result === "MISSING",
      )) {
        if (["AVAILABLE", "ALLOCATED"].includes(line.asset.status)) {
          assertTransition(line.asset.status, "LOST");
          await tx.asset.update({
            where: { id: line.assetId },
            data: { status: "LOST" },
          });
          await tx.assetHistory.create({
            data: {
              assetId: line.assetId,
              previousStatus: line.asset.status,
              newStatus: "LOST",
              actorId: actor.userId,
              reason: "Missing confirmed during audit closure",
              relatedType: "AuditCycle",
              relatedId: id,
            },
          });
        }
        if (line.discrepancy)
          await tx.auditDiscrepancy.update({
            where: { id: line.discrepancy.id },
            data: {
              status: "CONFIRMED",
              resolution: "Missing confirmed at audit closure",
            },
          });
      }
    await tx.auditCycle.update({ where: { id }, data: { status: "CLOSED" } });
    await log(
      tx,
      actor,
      "AUDIT_CLOSED",
      "AuditCycle",
      id,
      confirmMissing
        ? "Missing results confirmed"
        : "Closed without lifecycle changes",
    );
  });
}
