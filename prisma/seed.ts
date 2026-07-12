import {
  PrismaClient,
  RoleName,
  AssetStatus,
  MaintenanceStatus,
} from "@prisma/client";
import { hash } from "bcryptjs";
const db = new PrismaClient();
const password = "AssetFlowDemo!2026";
async function main() {
  const roles = Object.values(RoleName);
  for (const name of roles)
    await db.role.upsert({ where: { name }, update: {}, create: { name } });
  const h = await hash(password, 12);
  const hq = await db.location.upsert({
    where: { code: "HQ" },
    update: {},
    create: { name: "Headquarters", code: "HQ", address: "Bengaluru" },
  });
  const warehouse = await db.location.upsert({
    where: { code: "WH" },
    update: {},
    create: { name: "Central warehouse", code: "WH" },
  });
  const engineering = await db.department.upsert({
    where: { code: "ENG" },
    update: {},
    create: { name: "Engineering", code: "ENG" },
  });
  const operations = await db.department.upsert({
    where: { code: "OPS" },
    update: {},
    create: { name: "Operations", code: "OPS" },
  });
  const assurance = await db.department.upsert({
    where: { code: "ASR" },
    update: {},
    create: { name: "Assurance", code: "ASR" },
  });
  const people = [
    {
      email: "admin@assetflow.local",
      name: "Aanya Kapoor",
      number: "EMP-0001",
      role: "ADMIN" as RoleName,
      dept: operations.id,
    },
    {
      email: "manager@assetflow.local",
      name: "Vikram Singh",
      number: "EMP-0002",
      role: "ASSET_MANAGER" as RoleName,
      dept: operations.id,
    },
    {
      email: "head@assetflow.local",
      name: "Aarav Mehta",
      number: "EMP-0003",
      role: "DEPARTMENT_HEAD" as RoleName,
      dept: engineering.id,
    },
    {
      email: "employee@assetflow.local",
      name: "Neha Verma",
      number: "EMP-0004",
      role: "EMPLOYEE" as RoleName,
      dept: engineering.id,
    },
    {
      email: "auditor@assetflow.local",
      name: "Riya Rao",
      number: "EMP-0005",
      role: "AUDITOR" as RoleName,
      dept: assurance.id,
    },
  ];
  const employees = new Map<string, string>();
  for (const p of people) {
    const user = await db.user.upsert({
      where: { email: p.email },
      update: { passwordHash: h },
      create: { email: p.email, passwordHash: h },
    });
    const employee = await db.employee.upsert({
      where: { userId: user.id },
      update: { name: p.name, departmentId: p.dept, status: "ACTIVE" },
      create: {
        userId: user.id,
        name: p.name,
        employeeNumber: p.number,
        departmentId: p.dept,
      },
    });
    employees.set(p.email, employee.id);
    const role = await db.role.findUniqueOrThrow({ where: { name: p.role } });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
        reason: "Idempotent demo seed",
      },
    });
    const employeeRole = await db.role.findUniqueOrThrow({
      where: { name: "EMPLOYEE" },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
      update: {},
      create: {
        userId: user.id,
        roleId: employeeRole.id,
        reason: "Base employee access",
      },
    });
  }
  await db.department.update({
    where: { id: engineering.id },
    data: { headId: employees.get("head@assetflow.local") },
  });
  const electronics = await db.assetCategory.upsert({
    where: { code: "ELEC" },
    update: {},
    create: { name: "Electronics", code: "ELEC" },
  });
  const rooms = await db.assetCategory.upsert({
    where: { code: "ROOM" },
    update: {},
    create: { name: "Meeting rooms", code: "ROOM" },
  });
  const assets = [
    {
      tag: "AF-0001",
      name: "Dell Latitude 7450",
      status: "ALLOCATED" as AssetStatus,
      serialNumber: "DL7450-001",
      shared: false,
    },
    {
      tag: "AF-0002",
      name: "Epson EB-2250U",
      status: "UNDER_MAINTENANCE" as AssetStatus,
      serialNumber: "EP2250-001",
      shared: false,
    },
    {
      tag: "AF-0003",
      name: "Conference room B2",
      status: "AVAILABLE" as AssetStatus,
      serialNumber: null,
      shared: true,
    },
    {
      tag: "AF-0004",
      name: "MacBook Pro 16",
      status: "AVAILABLE" as AssetStatus,
      serialNumber: "MBP16-099",
      shared: false,
    },
    {
      tag: "AF-0005",
      name: "Cisco Router",
      status: "LOST" as AssetStatus,
      serialNumber: "CSR-121",
      shared: false,
    },
    {
      tag: "AF-0006",
      name: "ThinkPad T14",
      status: "RETIRED" as AssetStatus,
      serialNumber: "TP14-044",
      shared: false,
    },
  ];
  for (const a of assets)
    await db.asset.upsert({
      where: { tag: a.tag },
      update: { status: a.status },
      create: {
        ...a,
        categoryId: a.shared ? rooms.id : electronics.id,
        locationId: a.status === "RETIRED" ? warehouse.id : hq.id,
        owningDepartmentId: engineering.id,
        condition: a.status === "UNDER_MAINTENANCE" ? "DAMAGED" : "GOOD",
      },
    });
  const laptop = await db.asset.findUniqueOrThrow({
    where: { tag: "AF-0001" },
  });
  await db.allocation.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      assetId: laptop.id,
      employeeId: employees.get("employee@assetflow.local"),
      purpose: "Engineering work",
      conditionAtIssue: "GOOD",
      expectedReturnDate: new Date(Date.now() - 3 * 86400000),
      overdue: true,
    },
  });
  const projector = await db.asset.findUniqueOrThrow({
    where: { tag: "AF-0002" },
  });
  await db.maintenanceRequest.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      assetId: projector.id,
      raisedById: employees.get("employee@assetflow.local")!,
      issueDescription: "Projector bulb does not turn on",
      priority: "CRITICAL",
      status: MaintenanceStatus.IN_PROGRESS,
      technicianId: employees.get("manager@assetflow.local"),
    },
  });
  const room = await db.asset.findUniqueOrThrow({ where: { tag: "AF-0003" } });
  const start = new Date();
  start.setUTCHours(9, 0, 0, 0);
  await db.resourceBooking.upsert({
    where: { id: "00000000-0000-4000-8000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      resourceId: room.id,
      bookedById: employees.get("employee@assetflow.local")!,
      departmentId: engineering.id,
      startTime: start,
      endTime: new Date(start.getTime() + 3600000),
      purpose: "Sprint planning",
    },
  });
  await db.transferRequest.upsert({
    where: { id: "00000000-0000-4000-8000-000000000004" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000004",
      assetId: laptop.id,
      requesterId: employees.get("employee@assetflow.local")!,
      proposedHolderId: employees.get("head@assetflow.local")!,
      reason: "Project handover",
      status: "REQUESTED",
    },
  });
  const audit = await db.auditCycle.upsert({
    where: { id: "00000000-0000-4000-8000-000000000005" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000005",
      name: "Q3 Engineering Asset Audit",
      scopeType: "DEPARTMENT",
      departmentId: engineering.id,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 7 * 86400000),
      status: "IN_PROGRESS",
      assignments: {
        create: { auditorId: employees.get("auditor@assetflow.local")! },
      },
    },
  });
  const auditLine = await db.auditLine.upsert({
    where: { auditId_assetId: { auditId: audit.id, assetId: laptop.id } },
    update: {},
    create: {
      auditId: audit.id,
      assetId: laptop.id,
      auditorId: employees.get("auditor@assetflow.local")!,
      expectedHolder: "Neha Verma",
      expectedLocation: hq.name,
      expectedStatus: laptop.status,
      expectedCondition: laptop.condition,
      result: "MISSING",
      notes: "Not found at expected desk",
      verifiedAt: new Date(),
    },
  });
  await db.auditDiscrepancy.upsert({
    where: { auditLineId: auditLine.id },
    update: {},
    create: {
      auditLineId: auditLine.id,
      reason: "Asset missing from expected location",
    },
  });
  await db.notification.upsert({
    where: { dedupeKey: "seed:overdue-allocation" },
    update: {},
    create: {
      recipientId: employees.get("employee@assetflow.local")!,
      type: "OVERDUE_RETURN_ALERT",
      title: "Asset return overdue",
      message: "Dell Latitude AF-0001 is overdue for return.",
      severity: "WARNING",
      relatedType: "Allocation",
      relatedId: "00000000-0000-4000-8000-000000000001",
      dedupeKey: "seed:overdue-allocation",
    },
  });
  await db.organizationSetting.upsert({
    where: { key: "timezone" },
    update: { value: "Asia/Kolkata" },
    create: { key: "timezone", value: "Asia/Kolkata" },
  });
  await db.activityLog
    .create({
      data: {
        action: "SEED_COMPLETED",
        entityType: "System",
        outcome: "SUCCESS",
        reason: "Idempotent demo data",
      },
    })
    .catch(() => {});
  console.log(`Seeded AssetFlow. Demo password: ${password}`);
}
main().finally(() => db.$disconnect());
