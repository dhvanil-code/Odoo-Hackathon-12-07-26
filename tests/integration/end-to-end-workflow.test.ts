import { beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { Actor } from "@/auth/access";
const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("compulsory AssetFlow workflow", () => {
  let db: PrismaClient;
  const ids: Record<string, string> = {};
  let services: typeof import("@/modules/workflows/extended");
  let core: typeof import("@/modules/workflows/service");
  const suffix = Math.random().toString(36).slice(2, 8);
  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    });
    services = await import("@/modules/workflows/extended");
    core = await import("@/modules/workflows/service");
    const role = await db.role.upsert({
      where: { name: "EMPLOYEE" },
      update: {},
      create: { name: "EMPLOYEE" },
    });
    async function person(key: string, name: string) {
      const user = await db.user.create({
        data: {
          email: `${key}-${suffix}@assetflow.local`,
          passwordHash: "test",
          roles: { create: { roleId: role.id } },
          employee: { create: { name, employeeNumber: `${key}-${suffix}` } },
        },
        include: { employee: true },
      });
      ids[`${key}User`] = user.id;
      ids[key] = user.employee!.id;
    }
    await person("manager", "Workflow Manager");
    await person("first", "First Holder");
    await person("second", "Second Holder");
    await person("auditor", "Workflow Auditor");
    const location = await db.location.create({
      data: { code: `WF-L-${suffix}`, name: "Workflow location" },
    });
    ids.location = location.id;
    const category = await db.assetCategory.create({
      data: { code: `WF-C-${suffix}`, name: "Workflow category" },
    });
    const asset = await db.asset.create({
      data: {
        tag: `AF-W-${suffix}`,
        name: "Workflow laptop",
        categoryId: category.id,
        locationId: location.id,
        condition: "GOOD",
      },
    });
    ids.asset = asset.id;
    const auditAsset = await db.asset.create({
      data: {
        tag: `AF-A-${suffix}`,
        name: "Workflow audit asset",
        categoryId: category.id,
        locationId: location.id,
        condition: "GOOD",
      },
    });
    ids.auditAsset = auditAsset.id;
    const room = await db.asset.create({
      data: {
        tag: `AF-B-${suffix}`,
        name: "Workflow room",
        categoryId: category.id,
        locationId: location.id,
        condition: "GOOD",
        shared: true,
      },
    });
    ids.room = room.id;
  });
  const manager = (): Actor => ({
    userId: ids.managerUser,
    employeeId: ids.manager,
    roles: ["ASSET_MANAGER"],
    departmentId: null,
  });
  const first = (): Actor => ({
    userId: ids.firstUser,
    employeeId: ids.first,
    roles: ["EMPLOYEE"],
    departmentId: null,
  });
  const second = (): Actor => ({
    userId: ids.secondUser,
    employeeId: ids.second,
    roles: ["EMPLOYEE"],
    departmentId: null,
  });
  it("executes custody, scheduling, maintenance, return, and audit invariants", async () => {
    const allocation = await core.allocate(
      {
        assetId: ids.asset,
        employeeId: ids.first,
        purpose: "Workflow test",
        condition: "GOOD",
      },
      manager(),
    );
    await expect(
      core.allocate(
        {
          assetId: ids.asset,
          employeeId: ids.second,
          purpose: "Duplicate",
          condition: "GOOD",
        },
        manager(),
      ),
    ).rejects.toMatchObject({ code: "ASSET_ALREADY_ALLOCATED" });
    const transfer = await services.requestTransfer(
      {
        assetId: ids.asset,
        proposedHolderId: ids.second,
        reason: "Team handover",
      },
      first(),
    );
    await services.decideTransfer(
      transfer.id,
      "APPROVED",
      "Approved",
      manager(),
    );
    expect(
      (await db.allocation.findFirstOrThrow({ where: { id: allocation.id } }))
        .status,
    ).toBe("ACTIVE");
    await services.completeTransfer(
      transfer.id,
      { condition: "GOOD" },
      manager(),
    );
    expect(
      (await db.allocation.findFirstOrThrow({ where: { id: allocation.id } }))
        .status,
    ).toBe("TRANSFERRED");
    expect(
      await db.allocation.count({
        where: { assetId: ids.asset, status: "ACTIVE" },
      }),
    ).toBe(1);
    const start = new Date("2031-01-01T09:00:00Z");
    await core.book(
      {
        resourceId: ids.room,
        startTime: start,
        endTime: new Date("2031-01-01T10:00:00Z"),
        purpose: "First slot",
      },
      second(),
    );
    await expect(
      core.book(
        {
          resourceId: ids.room,
          startTime: new Date("2031-01-01T09:30:00Z"),
          endTime: new Date("2031-01-01T10:30:00Z"),
          purpose: "Overlap",
        },
        second(),
      ),
    ).rejects.toMatchObject({ code: "BOOKING_CONFLICT" });
    await expect(
      core.book(
        {
          resourceId: ids.room,
          startTime: new Date("2031-01-01T10:00:00Z"),
          endTime: new Date("2031-01-01T11:00:00Z"),
          purpose: "Back to back",
        },
        second(),
      ),
    ).resolves.toBeTruthy();
    const maintenance = await services.raiseMaintenance(
      {
        assetId: ids.asset,
        issueDescription: "Keyboard fault",
        priority: "HIGH",
      },
      second(),
    );
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: ids.asset } })).status,
    ).toBe("ALLOCATED");
    await services.transitionMaintenance(
      maintenance.id,
      { action: "APPROVE", notes: "Approved" },
      manager(),
    );
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: ids.asset } })).status,
    ).toBe("UNDER_MAINTENANCE");
    await expect(
      core.allocate(
        {
          assetId: ids.asset,
          employeeId: ids.first,
          purpose: "Blocked",
          condition: "GOOD",
        },
        manager(),
      ),
    ).rejects.toBeTruthy();
    await services.transitionMaintenance(
      maintenance.id,
      { action: "RESOLVE", notes: "Repaired", finalCondition: "GOOD" },
      manager(),
    );
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: ids.asset } })).status,
    ).toBe("ALLOCATED");
    const returned = await services.requestReturn(
      { assetId: ids.asset, reportedCondition: "GOOD" },
      second(),
    );
    await services.acceptReturn(
      returned.id,
      { verifiedCondition: "GOOD", newLocationId: ids.location },
      manager(),
    );
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: ids.asset } })).status,
    ).toBe("AVAILABLE");
    const audit = await db.auditCycle.create({
      data: {
        name: `Workflow audit ${suffix}`,
        scopeType: "ORGANIZATION",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        status: "SCHEDULED",
        assignments: { create: { auditorId: ids.auditor } },
      },
    });
    const admin: Actor = {
      userId: ids.managerUser,
      employeeId: ids.manager,
      roles: ["ADMIN"],
      departmentId: null,
    };
    await services.startAudit(audit.id, admin);
    const line = await db.auditLine.findFirstOrThrow({
      where: { auditId: audit.id, assetId: ids.auditAsset },
    });
    await services.verifyAuditLine(
      line.id,
      { result: "MISSING", notes: "Not found" },
      {
        userId: ids.auditorUser,
        employeeId: ids.auditor,
        roles: ["AUDITOR"],
        departmentId: null,
      },
    );
    expect(
      await db.auditDiscrepancy.count({ where: { auditLineId: line.id } }),
    ).toBe(1);
    for (const pending of await db.auditLine.findMany({
      where: { auditId: audit.id, result: "PENDING" },
    }))
      await services.verifyAuditLine(pending.id, { result: "VERIFIED" }, admin);
    await services.closeAudit(audit.id, true, admin);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: ids.auditAsset } }))
        .status,
    ).toBe("LOST");
    expect(
      (await db.auditCycle.findUniqueOrThrow({ where: { id: audit.id } }))
        .status,
    ).toBe("CLOSED");
  });
});
