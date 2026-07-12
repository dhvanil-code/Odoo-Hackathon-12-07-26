import type { Prisma } from "@prisma/client";
import { requireActor, isOrganizationWide } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Allocations() {
  const actor = await requireActor("assets:read");
  const scope: Prisma.AllocationWhereInput = isOrganizationWide(actor)
    ? {}
    : actor.roles.includes("DEPARTMENT_HEAD")
      ? {
          OR: [
            { departmentId: actor.departmentId },
            { employee: { departmentId: actor.departmentId } },
          ],
        }
      : { employeeId: actor.employeeId };
  const [
    allocations,
    availableAssets,
    employees,
    departments,
    transfers,
    returns,
    locations,
  ] = await Promise.all([
    db.allocation.findMany({
      where: { ...scope, status: "ACTIVE", actualReturnDate: null },
      include: {
        asset: true,
        employee: { include: { department: true } },
        department: true,
      },
      orderBy: { allocationDate: "desc" },
      take: 100,
    }),
    db.asset.findMany({
      where: { status: "AVAILABLE" },
      orderBy: { tag: "asc" },
      take: 200,
    }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      include: { department: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    db.transferRequest.findMany({
      where: isOrganizationWide(actor)
        ? {}
        : {
            OR: [
              { requesterId: actor.employeeId },
              { proposedHolderId: actor.employeeId },
            ],
          },
      include: { asset: true, requester: true, proposedHolder: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.returnRequest.findMany({
      where: isOrganizationWide(actor) ? {} : { employeeId: actor.employeeId },
      include: { asset: true, employee: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.location.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);
  const canAllocate =
    actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
  return (
    <Shell active="Allocation & transfers">
      <div className="page">
        <PageHead
          eyebrow="Asset custody"
          title="Allocations & transfers"
          description="Persisted custody, approval, handover, and return-inspection workflows."
          action={
            canAllocate ? (
              <ActionForm
                label="+ Allocate asset"
                title="Allocate an available asset"
                endpoint="/api/workflows/allocate"
                fields={[
                  {
                    name: "assetId",
                    label: "Asset",
                    type: "select",
                    required: true,
                    options: availableAssets.map((asset) => ({
                      value: asset.id,
                      label: `${asset.tag} · ${asset.name}`,
                    })),
                  },
                  {
                    name: "employeeId",
                    label: "Employee holder",
                    type: "select",
                    options: employees.map((employee) => ({
                      value: employee.id,
                      label: `${employee.name} · ${employee.department?.name ?? "No department"}`,
                    })),
                  },
                  {
                    name: "departmentId",
                    label: "Or department holder",
                    type: "select",
                    options: departments.map((department) => ({
                      value: department.id,
                      label: department.name,
                    })),
                  },
                  {
                    name: "purpose",
                    label: "Purpose",
                    type: "textarea",
                    required: true,
                  },
                  {
                    name: "condition",
                    label: "Condition at issue",
                    type: "select",
                    required: true,
                    defaultValue: "GOOD",
                    options: ["NEW", "EXCELLENT", "GOOD", "FAIR"].map(
                      (value) => ({ value, label: value }),
                    ),
                  },
                  {
                    name: "expectedReturnDate",
                    label: "Expected return",
                    type: "datetime-local",
                  },
                ]}
              />
            ) : undefined
          }
        />
        <div className="tabs">
          <div className="tab active">Active allocations</div>
          <div className="tab">Transfers ({transfers.length})</div>
          <div className="tab">Returns ({returns.length})</div>
        </div>
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Holder</th>
                <th>Department</th>
                <th>Allocated</th>
                <th>Expected return</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((allocation) => (
                <tr key={allocation.id}>
                  <td>
                    <b>{allocation.asset.tag}</b> · {allocation.asset.name}
                  </td>
                  <td>
                    {allocation.employee?.name ?? allocation.department?.name}
                  </td>
                  <td>
                    {allocation.employee?.department?.name ??
                      allocation.department?.name ??
                      "—"}
                  </td>
                  <td>{allocation.allocationDate.toLocaleDateString()}</td>
                  <td>
                    {allocation.expectedReturnDate?.toLocaleDateString() ??
                      "Open ended"}{" "}
                    {allocation.overdue && <Badge tone="red">Overdue</Badge>}
                  </td>
                  <td>
                    <div className="toolbar">
                      <ActionForm
                        label="Transfer"
                        title={`Transfer ${allocation.asset.tag}`}
                        endpoint="/api/workflows/request-transfer"
                        tone="secondary"
                        fields={[
                          {
                            name: "assetId",
                            label: "Asset ID",
                            defaultValue: allocation.assetId,
                            required: true,
                          },
                          {
                            name: "proposedHolderId",
                            label: "Proposed holder",
                            type: "select",
                            required: true,
                            options: employees
                              .filter(
                                (employee) =>
                                  employee.id !== allocation.employeeId,
                              )
                              .map((employee) => ({
                                value: employee.id,
                                label: employee.name,
                              })),
                          },
                          {
                            name: "reason",
                            label: "Reason",
                            type: "textarea",
                            required: true,
                          },
                          {
                            name: "requiredBy",
                            label: "Required by",
                            type: "datetime-local",
                          },
                        ]}
                      />
                      {allocation.employeeId === actor.employeeId ||
                      canAllocate ? (
                        <ActionForm
                          label="Return"
                          title={`Return ${allocation.asset.tag}`}
                          endpoint="/api/workflows/request-return"
                          tone="secondary"
                          fields={[
                            {
                              name: "assetId",
                              label: "Asset ID",
                              defaultValue: allocation.assetId,
                              required: true,
                            },
                            {
                              name: "reportedCondition",
                              label: "Reported condition",
                              type: "select",
                              required: true,
                              defaultValue: "GOOD",
                              options: [
                                "EXCELLENT",
                                "GOOD",
                                "FAIR",
                                "DAMAGED",
                                "UNUSABLE",
                              ].map((value) => ({ value, label: value })),
                            },
                            {
                              name: "proposedReturnDate",
                              label: "Proposed return",
                              type: "datetime-local",
                            },
                            {
                              name: "conditionNotes",
                              label: "Condition notes",
                              type: "textarea",
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allocations.length === 0 && (
            <p className="subtle">No active allocations in your scope.</p>
          )}
        </div>
        <section className="grid-2">
          <div className="card">
            <b>Transfer queue</b>
            {transfers.map((transfer) => (
              <div
                key={transfer.id}
                style={{ padding: "14px 0", borderBottom: "1px solid #edf0ed" }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>
                    {transfer.asset.tag} · {transfer.requester.name} →{" "}
                    {transfer.proposedHolder.name}
                  </span>
                  <Badge
                    tone={
                      transfer.status === "REJECTED"
                        ? "red"
                        : transfer.status === "REQUESTED"
                          ? "amber"
                          : ""
                    }
                  >
                    {transfer.status}
                  </Badge>
                </div>
                {canAllocate && transfer.status === "REQUESTED" && (
                  <div className="toolbar" style={{ marginTop: 8 }}>
                    <ActionForm
                      label="Approve"
                      title="Approve transfer"
                      endpoint="/api/workflows/decide-transfer"
                      fields={[
                        {
                          name: "id",
                          label: "Transfer ID",
                          defaultValue: transfer.id,
                          required: true,
                        },
                        {
                          name: "decision",
                          label: "Decision",
                          defaultValue: "APPROVED",
                          required: true,
                        },
                        {
                          name: "notes",
                          label: "Approval notes",
                          type: "textarea",
                        },
                      ]}
                    />
                    <ActionForm
                      label="Reject"
                      title="Reject transfer"
                      endpoint="/api/workflows/decide-transfer"
                      tone="secondary"
                      fields={[
                        {
                          name: "id",
                          label: "Transfer ID",
                          defaultValue: transfer.id,
                          required: true,
                        },
                        {
                          name: "decision",
                          label: "Decision",
                          defaultValue: "REJECTED",
                          required: true,
                        },
                        {
                          name: "notes",
                          label: "Reason",
                          type: "textarea",
                          required: true,
                        },
                      ]}
                    />
                  </div>
                )}
                {canAllocate && transfer.status === "APPROVED" && (
                  <ActionForm
                    label="Complete handover"
                    title="Complete transfer handover"
                    endpoint="/api/workflows/complete-transfer"
                    fields={[
                      {
                        name: "id",
                        label: "Transfer ID",
                        defaultValue: transfer.id,
                        required: true,
                      },
                      {
                        name: "condition",
                        label: "Handover condition",
                        type: "select",
                        required: true,
                        defaultValue: "GOOD",
                        options: ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"].map(
                          (value) => ({ value, label: value }),
                        ),
                      },
                      { name: "accessories", label: "Accessories" },
                      {
                        name: "notes",
                        label: "Handover notes",
                        type: "textarea",
                      },
                    ]}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="card">
            <b>Return inspections</b>
            {returns.map((request) => (
              <div
                key={request.id}
                style={{
                  padding: "14px 0",
                  borderBottom: "1px solid #edf0ed",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span>
                  {request.asset.tag} · {request.employee.name}
                </span>
                <Badge tone={request.status === "REQUESTED" ? "amber" : ""}>
                  {request.status}
                </Badge>
                {canAllocate && request.status !== "ACCEPTED" && (
                  <ActionForm
                    label="Inspect"
                    title={`Inspect return ${request.asset.tag}`}
                    endpoint="/api/workflows/accept-return"
                    fields={[
                      {
                        name: "id",
                        label: "Return ID",
                        defaultValue: request.id,
                        required: true,
                      },
                      {
                        name: "verifiedCondition",
                        label: "Verified condition",
                        type: "select",
                        required: true,
                        options: [
                          "EXCELLENT",
                          "GOOD",
                          "FAIR",
                          "DAMAGED",
                          "UNUSABLE",
                        ].map((value) => ({ value, label: value })),
                      },
                      {
                        name: "conditionNotes",
                        label: "Inspection notes",
                        type: "textarea",
                      },
                      {
                        name: "missingAccessories",
                        label: "Missing accessories",
                      },
                      {
                        name: "newLocationId",
                        label: "Storage location",
                        type: "select",
                        required: true,
                        options: locations.map((location) => ({
                          value: location.id,
                          label: location.name,
                        })),
                      },
                      {
                        name: "acceptDiscrepancy",
                        label: "Accept accessory discrepancy",
                        type: "checkbox",
                      },
                    ]}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
