import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { DomainError } from "@/lib/errors";

const signupSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(12).max(128),
    employeeNumber: z.string().min(2).max(50).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    for (const forbidden of [
      "role",
      "roles",
      "permission",
      "permissions",
      "admin",
      "departmentHead",
    ])
      if (forbidden in raw)
        throw new DomainError(
          "ROLE_FIELD_FORBIDDEN",
          "Signup cannot assign roles or permissions.",
        );
    const input = signupSchema.parse(raw);
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
      });
      if (existing)
        throw new DomainError(
          "EMAIL_IN_USE",
          "An account already exists for this email.",
        );
      const role = await tx.role.findUniqueOrThrow({
        where: { name: "EMPLOYEE" },
      });
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: await hash(input.password, 12),
          employee: {
            create: { name: input.name, employeeNumber: input.employeeNumber },
          },
          roles: { create: { roleId: role.id, reason: "Employee signup" } },
        },
        include: { employee: true },
      });
      await tx.activityLog.create({
        data: {
          actorId: user.id,
          action: "EMPLOYEE_SIGNUP",
          entityType: "User",
          entityId: user.id,
          outcome: "SUCCESS",
        },
      });
      return {
        id: user.id,
        employeeId: user.employee?.id,
        email: user.email,
        role: "EMPLOYEE",
      };
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
