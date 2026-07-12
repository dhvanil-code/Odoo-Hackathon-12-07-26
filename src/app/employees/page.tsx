import Link from "next/link";
import { requireActor } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Employees({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const actor = await requireActor();
  const admin = actor.roles.includes("ADMIN");
  const { view } = await searchParams;
  const inactive = admin && view === "inactive";
  if (!admin && !actor.roles.includes("DEPARTMENT_HEAD"))
    throw new Error("Forbidden");
  const [employees, departments] = await Promise.all([
    db.employee.findMany({
      where: admin
        ? { status: inactive ? "INACTIVE" : "ACTIVE" }
        : { departmentId: actor.departmentId, status: "ACTIVE" },
      include: {
        user: { include: { roles: { include: { role: true } } } },
        department: true,
      },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <Shell active="Employees">
      <div className="page">
        <PageHead
          eyebrow="People & access"
          title="Employee directory"
          description="Role changes are administrator-only, reasoned, notified, and immutably logged."
        />
        {admin && (
          <div className="tabs">
            <Link
              className={`tab ${inactive ? "" : "active"}`}
              href="/employees"
            >
              Active employees
            </Link>
            <Link
              className={`tab ${inactive ? "active" : ""}`}
              href="/employees?view=inactive"
            >
              Deleted employees
            </Link>
          </div>
        )}
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Number</th>
                <th>Department</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Access action</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const roles = employee.user.roles.map(
                  (entry) => entry.role.name,
                );
                return (
                  <tr key={employee.id}>
                    <td>
                      <b>{employee.name}</b>
                      <div className="subtle">{employee.user.email}</div>
                    </td>
                    <td>{employee.employeeNumber ?? "—"}</td>
                    <td>{employee.department?.name ?? "Unassigned"}</td>
                    <td>
                      {roles.map((role) => (
                        <Badge key={role}>{role.replaceAll("_", " ")}</Badge>
                      ))}
                    </td>
                    <td>
                      <Badge tone={employee.status === "INACTIVE" ? "red" : ""}>
                        {employee.status}
                      </Badge>
                    </td>
                    <td>
                      {admin && (
                        <div className="toolbar" style={{ marginBottom: 0 }}>
                          {inactive ? (
                            <ActionForm
                              label="Reassign"
                              title={`Reassign and restore ${employee.name}`}
                              endpoint={`/api/employees/${employee.id}`}
                              method="PATCH"
                              fields={[
                                {
                                  name: "departmentId",
                                  label: "Department",
                                  type: "select",
                                  required: true,
                                  defaultValue: employee.departmentId ?? "",
                                  options: departments.map((department) => ({
                                    value: department.id,
                                    label: department.name,
                                  })),
                                },
                                {
                                  name: "status",
                                  label: "Access",
                                  type: "select",
                                  required: true,
                                  defaultValue: "ACTIVE",
                                  options: [
                                    {
                                      value: "ACTIVE",
                                      label: "Restore employee",
                                    },
                                  ],
                                },
                                {
                                  name: "reason",
                                  label: "Reason for reassignment",
                                  type: "textarea",
                                  required: true,
                                },
                              ]}
                            />
                          ) : (
                            <>
                              <ActionForm
                                label="Change role"
                                title={`Change access for ${employee.name}`}
                                endpoint={`/api/employees/${employee.id}/roles`}
                                fields={[
                                  {
                                    name: "role",
                                    label: "Elevated role",
                                    type: "select",
                                    required: true,
                                    options: [
                                      "ASSET_MANAGER",
                                      "DEPARTMENT_HEAD",
                                      "AUDITOR",
                                    ].map((value) => ({
                                      value,
                                      label: value.replaceAll("_", " "),
                                    })),
                                  },
                                  {
                                    name: "action",
                                    label: "Action",
                                    type: "select",
                                    required: true,
                                    options: [
                                      { value: "ASSIGN", label: "Assign" },
                                      { value: "REMOVE", label: "Remove" },
                                    ],
                                  },
                                  {
                                    name: "reason",
                                    label: "Reason",
                                    type: "textarea",
                                    required: true,
                                  },
                                ]}
                              />
                              {employee.id !== actor.employeeId && (
                                <ActionForm
                                  label="Remove"
                                  title={`Remove ${employee.name}?`}
                                  endpoint={`/api/employees/${employee.id}`}
                                  method="PATCH"
                                  tone="secondary"
                                  fields={[
                                    {
                                      name: "status",
                                      label: "Action",
                                      type: "select",
                                      required: true,
                                      defaultValue: "INACTIVE",
                                      options: [
                                        {
                                          value: "INACTIVE",
                                          label: "Deactivate employee",
                                        },
                                      ],
                                    },
                                    {
                                      name: "reason",
                                      label: "Reason for removal",
                                      type: "textarea",
                                      required: true,
                                    },
                                  ]}
                                />
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
