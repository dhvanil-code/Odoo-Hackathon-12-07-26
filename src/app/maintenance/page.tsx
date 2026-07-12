import type { Prisma } from "@prisma/client";
import { requireActor, isOrganizationWide } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const stages = [
  "PENDING",
  "APPROVED",
  "TECHNICIAN_ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
] as const;
export default async function Maintenance() {
  const actor = await requireActor("maintenance:request");
  const scope: Prisma.MaintenanceRequestWhereInput = isOrganizationWide(actor)
    ? {}
    : actor.roles.includes("DEPARTMENT_HEAD")
      ? { raisedBy: { departmentId: actor.departmentId } }
      : { raisedById: actor.employeeId };
  const [requests, assets, technicians] = await Promise.all([
    db.maintenanceRequest.findMany({
      where: scope,
      include: { asset: true, raisedBy: true, technician: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.asset.findMany({
      where: isOrganizationWide(actor)
        ? { status: { notIn: ["LOST", "RETIRED", "DISPOSED"] } }
        : {
            allocations: {
              some: { status: "ACTIVE", employeeId: actor.employeeId },
            },
          },
      orderBy: { tag: "asc" },
    }),
    db.employee.findMany({
      where: {
        status: "ACTIVE",
        user: {
          roles: {
            some: { role: { name: { in: ["ASSET_MANAGER", "ADMIN"] } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const canManage =
    actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
  return (
    <Shell active="Maintenance">
      <div className="page">
        <PageHead
          eyebrow="Operations"
          title="Maintenance board"
          description="Pending requests leave lifecycle unchanged; approval moves the asset under maintenance."
          action={
            <ActionForm
              label="+ Raise request"
              title="Raise maintenance request"
              endpoint="/api/workflows/raise-maintenance"
              fields={[
                {
                  name: "assetId",
                  label: "Assigned asset",
                  type: "select",
                  required: true,
                  options: assets.map((asset) => ({
                    value: asset.id,
                    label: `${asset.tag} · ${asset.name}`,
                  })),
                },
                {
                  name: "issueDescription",
                  label: "Issue description",
                  type: "textarea",
                  required: true,
                },
                {
                  name: "priority",
                  label: "Priority",
                  type: "select",
                  required: true,
                  defaultValue: "MEDIUM",
                  options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
                    (value) => ({ value, label: value }),
                  ),
                },
              ]}
            />
          }
        />
        <div className="kanban">
          {stages.map((stage) => (
            <div className="column" key={stage}>
              <div className="column-head">
                <span>{stage.replaceAll("_", " ")}</span>
                <Badge>
                  {
                    requests.filter((request) => request.status === stage)
                      .length
                  }
                </Badge>
              </div>
              {requests
                .filter((request) => request.status === stage)
                .map((request) => (
                  <div className="ticket" key={request.id}>
                    <div className="subtle">
                      {request.asset.tag} · {request.raisedBy.name}
                    </div>
                    <b style={{ display: "block", margin: "7px 0 10px" }}>
                      {request.issueDescription}
                    </b>
                    <Badge
                      tone={
                        request.priority === "CRITICAL"
                          ? "red"
                          : request.priority === "HIGH"
                            ? "amber"
                            : ""
                      }
                    >
                      {request.priority}
                    </Badge>
                    {request.technician && (
                      <p className="subtle">
                        Technician: {request.technician.name}
                      </p>
                    )}
                    {canManage && (
                      <div style={{ marginTop: 10 }}>
                        {stage === "PENDING" && (
                          <ActionForm
                            label="Review"
                            title="Review maintenance request"
                            endpoint="/api/workflows/transition-maintenance"
                            fields={[
                              {
                                name: "id",
                                label: "Request ID",
                                defaultValue: request.id,
                                required: true,
                              },
                              {
                                name: "action",
                                label: "Decision",
                                type: "select",
                                required: true,
                                options: [
                                  { value: "APPROVE", label: "Approve" },
                                  { value: "REJECT", label: "Reject" },
                                ],
                              },
                              {
                                name: "notes",
                                label: "Decision notes",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                          />
                        )}{" "}
                        {stage === "APPROVED" && (
                          <ActionForm
                            label="Assign technician"
                            title="Assign technician"
                            endpoint="/api/workflows/transition-maintenance"
                            fields={[
                              {
                                name: "id",
                                label: "Request ID",
                                defaultValue: request.id,
                                required: true,
                              },
                              {
                                name: "action",
                                label: "Action",
                                defaultValue: "ASSIGN",
                                required: true,
                              },
                              {
                                name: "technicianId",
                                label: "Technician",
                                type: "select",
                                required: true,
                                options: technicians.map((employee) => ({
                                  value: employee.id,
                                  label: employee.name,
                                })),
                              },
                            ]}
                          />
                        )}{" "}
                        {stage === "TECHNICIAN_ASSIGNED" && (
                          <ActionForm
                            label="Start work"
                            title="Start maintenance"
                            endpoint="/api/workflows/transition-maintenance"
                            fields={[
                              {
                                name: "id",
                                label: "Request ID",
                                defaultValue: request.id,
                                required: true,
                              },
                              {
                                name: "action",
                                label: "Action",
                                defaultValue: "START",
                                required: true,
                              },
                              {
                                name: "notes",
                                label: "Work notes",
                                type: "textarea",
                              },
                            ]}
                          />
                        )}{" "}
                        {stage === "IN_PROGRESS" && (
                          <ActionForm
                            label="Resolve"
                            title="Resolve maintenance"
                            endpoint="/api/workflows/transition-maintenance"
                            fields={[
                              {
                                name: "id",
                                label: "Request ID",
                                defaultValue: request.id,
                                required: true,
                              },
                              {
                                name: "action",
                                label: "Action",
                                defaultValue: "RESOLVE",
                                required: true,
                              },
                              {
                                name: "finalCondition",
                                label: "Final condition",
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
                                name: "operationalCost",
                                label: "Operational cost",
                                type: "number",
                              },
                              {
                                name: "notes",
                                label: "Resolution notes",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
