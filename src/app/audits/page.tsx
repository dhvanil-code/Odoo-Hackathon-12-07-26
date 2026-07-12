import { requireActor } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Audits() {
  const actor = await requireActor();
  const admin = actor.roles.includes("ADMIN");
  const [audits, departments, locations, auditors] = await Promise.all([
    db.auditCycle.findMany({
      where: admin
        ? {}
        : actor.roles.includes("AUDITOR")
          ? { assignments: { some: { auditorId: actor.employeeId } } }
          : {
              OR: [
                { departmentId: actor.departmentId },
                { departmentId: null },
              ],
            },
      include: {
        assignments: { include: { auditor: true } },
        lines: { include: { asset: true, discrepancy: true } },
      },
      orderBy: { startDate: "desc" },
      take: 50,
    }),
    db.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    db.location.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    db.employee.findMany({
      where: {
        status: "ACTIVE",
        user: { roles: { some: { role: { name: "AUDITOR" } } } },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <Shell active="Audits">
      <div className="page">
        <PageHead
          eyebrow="Assurance"
          title="Asset audit cycles"
          description="Assigned scope, frozen expectations, evidence, discrepancies, review, and locked closure."
          action={
            admin ? (
              <ActionForm
                label="+ Create audit"
                title="Create audit cycle"
                endpoint="/api/admin/audits"
                fields={[
                  { name: "name", label: "Audit name", required: true },
                  {
                    name: "scopeType",
                    label: "Scope",
                    type: "select",
                    required: true,
                    options: ["ORGANIZATION", "DEPARTMENT", "LOCATION"].map(
                      (value) => ({ value, label: value }),
                    ),
                  },
                  {
                    name: "departmentId",
                    label: "Department scope",
                    type: "select",
                    options: departments.map((department) => ({
                      value: department.id,
                      label: department.name,
                    })),
                  },
                  {
                    name: "locationId",
                    label: "Location scope",
                    type: "select",
                    options: locations.map((location) => ({
                      value: location.id,
                      label: location.name,
                    })),
                  },
                  {
                    name: "startDate",
                    label: "Start",
                    type: "datetime-local",
                    required: true,
                  },
                  {
                    name: "endDate",
                    label: "End",
                    type: "datetime-local",
                    required: true,
                  },
                  {
                    name: "auditorIds",
                    label: "Auditor ID",
                    type: "select",
                    required: true,
                    options: auditors.map((auditor) => ({
                      value: auditor.id,
                      label: auditor.name,
                    })),
                  },
                  { name: "notes", label: "Notes", type: "textarea" },
                ]}
              />
            ) : undefined
          }
        />
        {audits.map((audit) => {
          const verified = audit.lines.filter(
            (line) => line.result === "VERIFIED",
          ).length;
          const flagged = audit.lines.filter((line) =>
            ["MISSING", "DAMAGED"].includes(line.result),
          ).length;
          return (
            <section
              className="card"
              style={{ marginBottom: 16 }}
              key={audit.id}
            >
              <div className="page-head" style={{ marginBottom: 12 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{audit.name}</h2>
                  <p className="subtle">
                    {audit.startDate.toLocaleDateString()}–
                    {audit.endDate.toLocaleDateString()} ·{" "}
                    {audit.assignments
                      .map((assignment) => assignment.auditor.name)
                      .join(", ")}
                  </p>
                </div>
                <div className="toolbar">
                  <Badge tone={audit.status === "CLOSED" ? "" : "amber"}>
                    {audit.status.replaceAll("_", " ")}
                  </Badge>
                  {admin && ["DRAFT", "SCHEDULED"].includes(audit.status) && (
                    <ActionForm
                      label="Start cycle"
                      title="Start audit cycle"
                      endpoint="/api/workflows/start-audit"
                      fields={[
                        {
                          name: "id",
                          label: "Audit ID",
                          defaultValue: audit.id,
                          required: true,
                        },
                      ]}
                    />
                  )}{" "}
                  {admin &&
                    ["IN_PROGRESS", "REVIEW"].includes(audit.status) && (
                      <ActionForm
                        label="Close cycle"
                        title="Close and lock audit"
                        endpoint="/api/workflows/close-audit"
                        fields={[
                          {
                            name: "id",
                            label: "Audit ID",
                            defaultValue: audit.id,
                            required: true,
                          },
                          {
                            name: "confirmMissing",
                            label: "Confirm missing assets as Lost",
                            type: "checkbox",
                          },
                        ]}
                      />
                    )}
                </div>
              </div>
              <div className="kpis">
                <div>
                  <span className="subtle">Scope</span>
                  <div className="kpi-value">{audit.lines.length}</div>
                </div>
                <div>
                  <span className="subtle">Verified</span>
                  <div className="kpi-value">{verified}</div>
                </div>
                <div>
                  <span className="subtle">Flagged</span>
                  <div className="kpi-value">{flagged}</div>
                </div>
              </div>
              {audit.lines.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Expected location</th>
                        <th>Expected holder</th>
                        <th>Result</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            {line.asset.tag} · {line.asset.name}
                          </td>
                          <td>{line.expectedLocation}</td>
                          <td>{line.expectedHolder ?? "—"}</td>
                          <td>
                            <Badge
                              tone={
                                ["MISSING", "DAMAGED"].includes(line.result)
                                  ? "red"
                                  : line.result === "PENDING"
                                    ? "amber"
                                    : ""
                              }
                            >
                              {line.result}
                            </Badge>
                          </td>
                          <td>
                            {line.result === "PENDING" &&
                              audit.status === "IN_PROGRESS" && (
                                <ActionForm
                                  label="Verify"
                                  title={`Verify ${line.asset.tag}`}
                                  endpoint="/api/workflows/verify-audit-line"
                                  tone="secondary"
                                  fields={[
                                    {
                                      name: "id",
                                      label: "Audit line ID",
                                      defaultValue: line.id,
                                      required: true,
                                    },
                                    {
                                      name: "result",
                                      label: "Result",
                                      type: "select",
                                      required: true,
                                      options: [
                                        "VERIFIED",
                                        "MISSING",
                                        "DAMAGED",
                                      ].map((value) => ({
                                        value,
                                        label: value,
                                      })),
                                    },
                                    {
                                      name: "actualLocation",
                                      label: "Actual location",
                                    },
                                    {
                                      name: "actualHolder",
                                      label: "Actual holder",
                                    },
                                    {
                                      name: "notes",
                                      label: "Notes/evidence reference",
                                      type: "textarea",
                                    },
                                  ]}
                                />
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
        {audits.length === 0 && (
          <div className="card">
            <p className="subtle">No audit cycles are assigned to you.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
