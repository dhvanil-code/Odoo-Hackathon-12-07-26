export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
export function databaseError(error: unknown): never {
  const e = error as { code?: string; meta?: unknown };
  if (e.code === "P2002" || e.code === "P2004")
    throw new DomainError(
      "CONFLICT",
      "The record conflicts with an active workflow.",
      e.meta,
    );
  throw error;
}
