import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { jsonError } from "@/lib/http";

const uuid = z.uuid();
const schemas = {
  departments: z.object({
    name: z.string().min(2).max(120),
    code: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Z0-9_-]+$/),
    description: z.string().max(1000).optional(),
    parentId: uuid.optional(),
    headId: uuid.optional(),
  }),
  categories: z.object({
    name: z.string().min(2).max(120),
    code: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Z0-9_-]+$/),
    description: z.string().max(1000).optional(),
    attributes: z
      .array(
        z.object({
          name: z.string().min(1),
          code: z.string().regex(/^[a-z][a-z0-9_]*$/),
          fieldType: z.enum(["text", "number", "date", "boolean", "select"]),
          required: z.boolean().default(false),
          options: z.array(z.string()).optional(),
        }),
      )
      .default([]),
  }),
  assets: z.object({
    name: z.string().min(2).max(200),
    categoryId: uuid,
    serialNumber: z.string().max(200).optional(),
    acquisitionDate: z.coerce.date().optional(),
    acquisitionCost: z.coerce.number().nonnegative().optional(),
    condition: z.enum([
      "NEW",
      "EXCELLENT",
      "GOOD",
      "FAIR",
      "DAMAGED",
      "UNUSABLE",
    ]),
    locationId: uuid,
    owningDepartmentId: uuid.optional(),
    manufacturer: z.string().max(200).optional(),
    model: z.string().max(200).optional(),
    warrantyExpiry: z.coerce.date().optional(),
    notes: z.string().max(4000).optional(),
    shared: z.boolean().default(false),
    customAttributes: z.record(z.string(), z.unknown()).default({}),
  }),
  audits: z.object({
    name: z.string().min(3).max(200),
    scopeType: z.enum(["ORGANIZATION", "DEPARTMENT", "LOCATION"]),
    departmentId: uuid.optional(),
    locationId: uuid.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    auditorIds: z
      .union([uuid, z.array(uuid).min(1)])
      .transform((value) => (typeof value === "string" ? [value] : value)),
    notes: z.string().max(4000).optional(),
  }),
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const actor = await requireActor();
    const { resource } = await context.params;
    if (!(resource in schemas))
      return Response.json({ code: "UNKNOWN_RESOURCE" }, { status: 404 });
    const input = schemas[resource as keyof typeof schemas].parse(
      await request.json(),
    );
    if (resource === "departments") {
      if (!actor.roles.includes("ADMIN"))
        throw new DomainError("FORBIDDEN", "Admin permission is required.");
      const value = input as z.infer<typeof schemas.departments>;
      const created = await db.department.create({ data: value });
      await db.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "DEPARTMENT_CREATED",
          entityType: "Department",
          entityId: created.id,
          newValues: value,
        },
      });
      return Response.json(created, { status: 201 });
    }
    if (resource === "categories") {
      if (!actor.roles.includes("ADMIN"))
        throw new DomainError("FORBIDDEN", "Admin permission is required.");
      const value = input as z.infer<typeof schemas.categories>;
      const created = await db.assetCategory.create({
        data: {
          name: value.name,
          code: value.code,
          description: value.description,
          attributes: {
            create: value.attributes.map((attribute) => ({
              ...attribute,
              options: attribute.options ?? [],
            })),
          },
        },
      });
      await db.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "CATEGORY_CREATED",
          entityType: "AssetCategory",
          entityId: created.id,
        },
      });
      return Response.json(created, { status: 201 });
    }
    if (resource === "assets") {
      if (
        !actor.roles.some(
          (role) => role === "ADMIN" || role === "ASSET_MANAGER",
        )
      )
        throw new DomainError(
          "FORBIDDEN",
          "Asset registration permission is required.",
        );
      const value = input as z.infer<typeof schemas.assets>;
      const created = await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(413378)`;
          const last = await tx.asset.findFirst({
            orderBy: { tag: "desc" },
            select: { tag: true },
          });
          const number = Number(last?.tag.match(/(\d+)$/)?.[1] ?? 0) + 1;
          const tag = `AF-${String(number).padStart(4, "0")}`;
          const asset = await tx.asset.create({
            data: {
              ...value,
              customAttributes: value.customAttributes as Prisma.InputJsonValue,
              tag,
              status: "AVAILABLE",
            },
          });
          await tx.assetHistory.create({
            data: {
              assetId: asset.id,
              newStatus: "AVAILABLE",
              actorId: actor.userId,
              reason: "Asset registered",
            },
          });
          await tx.activityLog.create({
            data: {
              actorId: actor.userId,
              action: "ASSET_CREATED",
              entityType: "Asset",
              entityId: asset.id,
              newValues: { tag, name: asset.name },
            },
          });
          return asset;
        },
        { isolationLevel: "Serializable" },
      );
      return Response.json(created, { status: 201 });
    }
    if (resource === "audits") {
      if (!actor.roles.includes("ADMIN"))
        throw new DomainError("FORBIDDEN", "Admin permission is required.");
      const value = input as z.infer<typeof schemas.audits>;
      if (value.startDate >= value.endDate)
        throw new DomainError(
          "INVALID_DATE_RANGE",
          "Audit start must be before its end.",
        );
      const created = await db.auditCycle.create({
        data: {
          name: value.name,
          scopeType: value.scopeType,
          departmentId: value.departmentId,
          locationId: value.locationId,
          startDate: value.startDate,
          endDate: value.endDate,
          notes: value.notes,
          status: "SCHEDULED",
          assignments: {
            create: value.auditorIds.map((auditorId) => ({ auditorId })),
          },
        },
      });
      await db.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "AUDIT_CREATED",
          entityType: "AuditCycle",
          entityId: created.id,
        },
      });
      return Response.json(created, { status: 201 });
    }
    throw new DomainError("UNKNOWN_RESOURCE", "Unsupported resource.");
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    const actor = await requireActor("org:manage");
    const { resource } = await context.params;
    const raw = await request.json();
    const id = uuid.parse(raw.id);
    if (resource === "departments") {
      const input = z
        .object({
          id: uuid,
          name: z.string().min(2).max(120).optional(),
          description: z.string().max(1000).optional(),
          parentId: uuid.nullable().optional(),
          headId: uuid.nullable().optional(),
          status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        })
        .parse(raw);
      if (input.parentId === id)
        throw new DomainError(
          "CIRCULAR_DEPARTMENT",
          "A department cannot be its own parent.",
        );
      let cursor = input.parentId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === id || visited.has(cursor))
          throw new DomainError(
            "CIRCULAR_DEPARTMENT",
            "This parent would create a circular hierarchy.",
          );
        visited.add(cursor);
        cursor = (
          await db.department.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          })
        )?.parentId;
      }
      const old = await db.department.findUniqueOrThrow({ where: { id } });
      const updated = await db.$transaction(async (tx) => {
        const result = await tx.department.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            parentId: input.parentId,
            headId: input.headId,
            status: input.status,
          },
        });
        await tx.activityLog.create({
          data: {
            actorId: actor.userId,
            action: "DEPARTMENT_UPDATED",
            entityType: "Department",
            entityId: id,
            oldValues: old,
            newValues: input,
          },
        });
        return result;
      });
      return Response.json(updated);
    }
    if (resource === "categories") {
      const input = z
        .object({
          id: uuid,
          name: z.string().min(2).max(120).optional(),
          description: z.string().max(1000).optional(),
          status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        })
        .parse(raw);
      const updated = await db.assetCategory.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
        },
      });
      await db.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "CATEGORY_UPDATED",
          entityType: "AssetCategory",
          entityId: id,
          newValues: input,
        },
      });
      return Response.json(updated);
    }
    throw new DomainError("UNKNOWN_RESOURCE", "Unsupported resource.");
  } catch (error) {
    return jsonError(error);
  }
}
