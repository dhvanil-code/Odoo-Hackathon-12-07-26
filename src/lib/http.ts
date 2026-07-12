import { DomainError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Check the submitted fields.",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return Response.json(
        {
          code: "CONFLICT",
          message: "A record with those unique values already exists.",
        },
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json(
        {
          code: "NOT_FOUND",
          message: "The requested record no longer exists.",
        },
        { status: 404 },
      );
    }
  }
  if (error instanceof DomainError) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code.startsWith("FORBIDDEN")
          ? 403
          : error.code.includes("CONFLICT") ||
              error.code.includes("ALREADY") ||
              error.code === "EMAIL_IN_USE"
            ? 409
            : 400;
    return Response.json(
      { code: error.code, message: error.message, details: error.details },
      { status },
    );
  }
  console.error(error);
  return Response.json(
    {
      code: "INTERNAL_ERROR",
      message: "The operation could not be completed.",
    },
    { status: 500 },
  );
}
