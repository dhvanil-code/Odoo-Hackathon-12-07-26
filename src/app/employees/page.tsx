import { requireActor } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Employees() {
  const actor = await requireActor();
  const admin = actor.roles.includes("ADMIN");
  if (!admin && !actor.roles.includes("DEPARTMENT_HEAD"))
    throw new Error("Forbidden");
  const employees = await db.employee.findMany({
    where: admin ? {} : { departmentId: actor.departmentId },
    include: {
      user: { include: { roles: { include: { role: true } } } },
      department: true,
    },
    orderBy: { name: "asc" },
  });
  return (
    <Shell active="Employees">
      <div className="page">
        <PageHead
          eyebrow="People & access"
          title="Employee directory"
          description="Role changes are administrator-only, reasoned, notified, and immutably logged."
        />
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
