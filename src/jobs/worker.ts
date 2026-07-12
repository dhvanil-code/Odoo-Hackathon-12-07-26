import { differenceInCalendarDays } from "date-fns";
import { db } from "@/lib/db";

async function notify(
  recipientId: string,
  type: string,
  title: string,
  message: string,
  relatedType: string,
  relatedId: string,
  dedupeKey: string,
  severity: "INFO" | "WARNING" | "ERROR" = "INFO",
) {
  await db.notification.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      recipientId,
      type,
      title,
      message,
      relatedType,
      relatedId,
      dedupeKey,
      severity,
    },
  });
}
async function run() {
  const now = new Date();
  await db.allocation.updateMany({
    where: {
      status: "ACTIVE",
      actualReturnDate: null,
      expectedReturnDate: { lt: now },
    },
    data: { overdue: true },
  });
  const allocations = await db.allocation.findMany({
    where: {
      status: "ACTIVE",
      actualReturnDate: null,
      expectedReturnDate: { not: null },
    },
    include: {
      employee: { include: { department: { include: { head: true } } } },
    },
  });
  const managers = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      user: {
        roles: {
          some: { role: { name: { in: ["ASSET_MANAGER", "ADMIN"] } } },
        },
      },
    },
  });
  for (const allocation of allocations) {
    const days = differenceInCalendarDays(now, allocation.expectedReturnDate!);
    if (![0, 1, 3, 7].includes(days)) continue;
    const label =
      days === 0 ? "due today" : `${days} day${days === 1 ? "" : "s"} overdue`;
    for (const recipient of [
      allocation.employeeId,
      ...(days >= 3
        ? [
            allocation.employee?.department?.head?.id,
            ...managers.map((item) => item.id),
          ]
        : []),
    ])
      if (recipient)
        await notify(
          recipient,
          "OVERDUE_RETURN_ALERT",
          "Asset return reminder",
          `An allocated asset is ${label}.`,
          "Allocation",
          allocation.id,
          `allocation:${allocation.id}:overdue:${days}`,
          days >= 3 ? "ERROR" : "WARNING",
        );
  }
  await db.resourceBooking.updateMany({
    where: {
      status: "UPCOMING",
      startTime: { lte: now },
      endTime: { gt: now },
    },
    data: { status: "ONGOING" },
  });
  await db.resourceBooking.updateMany({
    where: { status: { in: ["UPCOMING", "ONGOING"] }, endTime: { lte: now } },
    data: { status: "COMPLETED" },
  });
  const reminders = await db.resourceBooking.findMany({
    where: {
      status: "UPCOMING",
      startTime: { gt: now, lte: new Date(now.getTime() + 60 * 60000) },
    },
  });
  for (const booking of reminders)
    await notify(
      booking.bookedById,
      "BOOKING_REMINDER",
      "Booking starts soon",
      `Your booking starts at ${booking.startTime.toISOString()}.`,
      "ResourceBooking",
      booking.id,
      `booking:${booking.id}:reminder`,
    );
  const staleMaintenance = await db.maintenanceRequest.findMany({
    where: {
      status: { notIn: ["REJECTED", "RESOLVED"] },
      createdAt: { lt: new Date(now.getTime() - 24 * 3600000) },
    },
  });
  for (const request of staleMaintenance)
    for (const manager of managers)
      await notify(
        manager.id,
        "MAINTENANCE_ESCALATION",
        "Maintenance SLA exceeded",
        `Request ${request.id.slice(0, 8)} needs attention.`,
        "MaintenanceRequest",
        request.id,
        `maintenance:${request.id}:sla:${manager.id}`,
        "WARNING",
      );
  const audits = await db.auditCycle.findMany({
    where: {
      status: { in: ["SCHEDULED", "IN_PROGRESS", "REVIEW"] },
      endDate: { gte: now, lte: new Date(now.getTime() + 48 * 3600000) },
    },
    include: { assignments: true },
  });
  for (const audit of audits)
    for (const assignment of audit.assignments)
      await notify(
        assignment.auditorId,
        "AUDIT_DEADLINE_REMINDER",
        "Audit deadline approaching",
        `${audit.name} is due ${audit.endDate.toISOString()}.`,
        "AuditCycle",
        audit.id,
        `audit:${audit.id}:deadline:${assignment.auditorId}`,
        "WARNING",
      );
  await db.jobRun.upsert({
    where: { dedupeKey: `worker:${now.toISOString().slice(0, 13)}` },
    update: { result: { completed: true } },
    create: {
      jobName: "operational-sweep",
      dedupeKey: `worker:${now.toISOString().slice(0, 13)}`,
      result: { completed: true },
    },
  });
}
run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
