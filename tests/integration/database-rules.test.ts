import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_DB_TESTS === "true";
describe.skipIf(!enabled)("PostgreSQL business constraints", () => {
  let db: PrismaClient;
  let employeeId = "";
  let assetId = "";
  let resourceId = "";
  const suffix = Math.random().toString(36).slice(2, 9);
  beforeAll(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({
      datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
    });
    const role = await db.role.upsert({
      where: { name: "EMPLOYEE" },
      update: {},
      create: { name: "EMPLOYEE" },
    });
    const user = await db.user.create({
      data: {
        email: `integration-${suffix}@assetflow.local`,
        passwordHash: "test-only",
        roles: { create: { roleId: role.id, reason: "Integration fixture" } },
        employee: {
          create: {
            name: "Integration Employee",
            employeeNumber: `IT-${suffix}`,
          },
        },
      },
      include: { employee: true },
    });
    employeeId = user.employee!.id;
    const location = await db.location.create({
      data: { code: `L-${suffix}`, name: "Integration location" },
    });
    const category = await db.assetCategory.create({
      data: { code: `C-${suffix}`, name: "Integration category" },
    });
    assetId = (
      await db.asset.create({
        data: {
          tag: `AF-I-${suffix}`,
          name: "Allocation test asset",
          categoryId: category.id,
          locationId: location.id,
          condition: "GOOD",
        },
      })
    ).id;
    resourceId = (
      await db.asset.create({
        data: {
          tag: `AF-R-${suffix}`,
          name: "Booking test room",
          categoryId: category.id,
          locationId: location.id,
          condition: "GOOD",
          shared: true,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  it("allows exactly one active allocation under concurrent writes", async () => {
    const create = () =>
      db.allocation.create({
        data: {
          assetId,
          employeeId,
          purpose: "Constraint test",
          conditionAtIssue: "GOOD",
        },
      });
    const results = await Promise.allSettled([create(), create()]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });
  it("permits back-to-back bookings and rejects overlap", async () => {
    const start = new Date("2030-01-01T09:00:00.000Z");
    await db.resourceBooking.create({
      data: {
        resourceId,
        bookedById: employeeId,
        startTime: start,
        endTime: new Date("2030-01-01T10:00:00.000Z"),
        purpose: "First",
      },
    });
    await expect(
      db.resourceBooking.create({
        data: {
          resourceId,
          bookedById: employeeId,
          startTime: new Date("2030-01-01T10:00:00.000Z"),
          endTime: new Date("2030-01-01T11:00:00.000Z"),
          purpose: "Back to back",
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      db.resourceBooking.create({
        data: {
          resourceId,
          bookedById: employeeId,
          startTime: new Date("2030-01-01T09:30:00.000Z"),
          endTime: new Date("2030-01-01T10:30:00.000Z"),
          purpose: "Overlap",
        },
      }),
    ).rejects.toBeTruthy();
  });
  it("does not change asset lifecycle for a pending maintenance request", async () => {
    await db.maintenanceRequest.create({
      data: {
        assetId: resourceId,
        raisedById: employeeId,
        issueDescription: "Pending state test",
        status: "PENDING",
      },
    });
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: resourceId } })).status,
    ).toBe("AVAILABLE");
  });
});
