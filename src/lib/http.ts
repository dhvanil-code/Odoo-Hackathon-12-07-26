import { DomainError } from "@/lib/errors";

export function jsonError(error: unknown) {
  if (error instanceof DomainError) {
    const status =
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code.startsWith("FORBIDDEN")
          ? 403
          : error.code.includes("CONFLICT") || error.code.includes("ALREADY")
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
