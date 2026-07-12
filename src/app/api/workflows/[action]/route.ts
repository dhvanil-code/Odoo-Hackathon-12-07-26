import { z } from "zod";
import { requireActor } from "@/auth/access";
import { jsonError } from "@/lib/http";
import { allocate, book } from "@/modules/workflows/service";
import {
  acceptReturn,
  cancelBooking,
  closeAudit,
  completeTransfer,
  decideTransfer,
  raiseMaintenance,
  requestReturn,
  requestTransfer,
  rescheduleBooking,
  startAudit,
  transitionMaintenance,
  verifyAuditLine,
} from "@/modules/workflows/extended";

const uuid = z.uuid();
const condition = z.enum([
  "NEW",
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "DAMAGED",
  "UNUSABLE",
]);
const schemas = {
  allocate: z.object({
    assetId: uuid,
    employeeId: uuid.optional(),
    departmentId: uuid.optional(),
    purpose: z.string().min(3).max(500),
    condition,
    expectedReturnDate: z.coerce.date().optional(),
  }),
  book: z.object({
    resourceId: uuid,
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    purpose: z.string().min(3).max(500),
    attendeeCount: z.coerce.number().int().positive().max(10000).optional(),
  }),
  "cancel-booking": z.object({ id: uuid }),
  "reschedule-booking": z.object({
    id: uuid,
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  }),
  "request-transfer": z.object({
    assetId: uuid,
    proposedHolderId: uuid,
    reason: z.string().min(3).max(1000),
    requiredBy: z.coerce.date().optional(),
    notes: z.string().max(2000).optional(),
  }),
  "decide-transfer": z.object({
    id: uuid,
    decision: z.enum(["APPROVED", "REJECTED"]),
    notes: z.string().max(2000).optional(),
  }),
  "complete-transfer": z.object({
    id: uuid,
    condition,
    accessories: z.string().max(1000).optional(),
    notes: z.string().max(2000).optional(),
  }),
  "request-return": z.object({
    assetId: uuid,
    proposedReturnDate: z.coerce.date().optional(),
    reportedCondition: condition,
    conditionNotes: z.string().max(2000).optional(),
    accessoriesReturned: z.string().max(1000).optional(),
  }),
  "accept-return": z.object({
    id: uuid,
    verifiedCondition: condition,
    conditionNotes: z.string().max(2000).optional(),
    missingAccessories: z.string().max(1000).optional(),
    newLocationId: uuid,
    acceptDiscrepancy: z.boolean().optional(),
  }),
  "raise-maintenance": z.object({
    assetId: uuid,
    issueDescription: z.string().min(5).max(4000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  }),
  "transition-maintenance": z.object({
    id: uuid,
    action: z.enum(["APPROVE", "REJECT", "ASSIGN", "START", "RESOLVE"]),
    notes: z.string().max(4000).optional(),
    technicianId: uuid.optional(),
    finalCondition: condition.optional(),
    operationalCost: z.coerce.number().nonnegative().max(999999999).optional(),
  }),
  "start-audit": z.object({ id: uuid }),
  "verify-audit-line": z.object({
    id: uuid,
    result: z.enum(["VERIFIED", "MISSING", "DAMAGED"]),
    actualLocation: z.string().max(500).optional(),
    actualHolder: z.string().max(500).optional(),
    notes: z.string().max(4000).optional(),
  }),
  "close-audit": z.object({
    id: uuid,
    confirmMissing: z.boolean().default(false),
  }),
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await context.params;
    if (!(action in schemas))
      return Response.json({ code: "UNKNOWN_ACTION" }, { status: 404 });
    const input = schemas[action as keyof typeof schemas].parse(
      await request.json(),
    ) as never;
    const actor = await requireActor();
    let result: unknown;
    switch (action) {
      case "allocate":
        result = await allocate(input, actor);
        break;
      case "book":
        result = await book(input, actor);
        break;
      case "cancel-booking":
        result = await cancelBooking((input as { id: string }).id, actor);
        break;
      case "reschedule-booking": {
        const value = input as z.infer<(typeof schemas)["reschedule-booking"]>;
        result = await rescheduleBooking(
          value.id,
          value.startTime,
          value.endTime,
          actor,
        );
        break;
      }
      case "request-transfer":
        result = await requestTransfer(input, actor);
        break;
      case "decide-transfer": {
        const value = input as z.infer<(typeof schemas)["decide-transfer"]>;
        result = await decideTransfer(
          value.id,
          value.decision,
          value.notes,
          actor,
        );
        break;
      }
      case "complete-transfer": {
        const value = input as z.infer<(typeof schemas)["complete-transfer"]>;
        result = await completeTransfer(value.id, value, actor);
        break;
      }
      case "request-return":
        result = await requestReturn(input, actor);
        break;
      case "accept-return": {
        const value = input as z.infer<(typeof schemas)["accept-return"]>;
        result = await acceptReturn(value.id, value, actor);
        break;
      }
      case "raise-maintenance":
        result = await raiseMaintenance(input, actor);
        break;
      case "transition-maintenance": {
        const value = input as z.infer<
          (typeof schemas)["transition-maintenance"]
        >;
        result = await transitionMaintenance(value.id, value, actor);
        break;
      }
      case "start-audit":
        result = await startAudit((input as { id: string }).id, actor);
        break;
      case "verify-audit-line": {
        const value = input as z.infer<(typeof schemas)["verify-audit-line"]>;
        result = await verifyAuditLine(value.id, value, actor);
        break;
      }
      case "close-audit": {
        const value = input as z.infer<(typeof schemas)["close-audit"]>;
        result = await closeAudit(value.id, value.confirmMissing, actor);
        break;
      }
    }
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return jsonError(error);
  }
}
