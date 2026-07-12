import type { AssetStatus } from "@prisma/client";
import { DomainError } from "@/lib/errors";
const transitions: Record<AssetStatus, readonly AssetStatus[]> = {
  AVAILABLE: ["ALLOCATED", "RESERVED", "UNDER_MAINTENANCE", "LOST", "RETIRED"],
  ALLOCATED: ["AVAILABLE", "ALLOCATED", "UNDER_MAINTENANCE", "LOST"],
  RESERVED: ["AVAILABLE", "UNDER_MAINTENANCE"],
  UNDER_MAINTENANCE: ["AVAILABLE", "ALLOCATED", "RETIRED"],
  LOST: ["AVAILABLE", "RETIRED"],
  RETIRED: ["DISPOSED", "AVAILABLE"],
  DISPOSED: [],
};
export function assertTransition(
  from: AssetStatus,
  to: AssetStatus,
  authorizedRestoration = false,
) {
  if (from === to && to === "ALLOCATED") return;
  if (!transitions[from].includes(to))
    throw new DomainError(
      "INVALID_ASSET_TRANSITION",
      `${from} cannot transition to ${to}.`,
    );
  if (
    (from === "LOST" || from === "RETIRED") &&
    to === "AVAILABLE" &&
    !authorizedRestoration
  )
    throw new DomainError(
      "RESTORATION_REQUIRES_AUTHORIZATION",
      "Restoration requires an authorized reason.",
    );
}
export { transitions };
