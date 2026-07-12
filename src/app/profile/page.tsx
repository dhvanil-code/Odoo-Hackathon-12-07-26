import { requireActor } from "@/auth/access";
import { Shell } from "@/components/shell";
import { Badge, PageHead } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Profile() {
  const actor = await requireActor();
  const employee = await db.employee.findUniqueOrThrow({
    where: { id: actor.employeeId },
    include: {
      user: { include: { roles: { include: { role: true } } } },
      department: true,
      allocations: {
        where: { status: "ACTIVE", actualReturnDate: null },
        include: { asset: true },
        orderBy: { allocationDate: "desc" },
      },
    },
  });
  return (
    <Shell active="Profile">
      <div className="page">
        <PageHead
          eyebrow="Your account"
          title="Profile"
          description="Your identity, access roles, department, and currently assigned assets."
        />
        <section className="card profile-card">
          <div className="profile-avatar">
            {employee.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2>{employee.name}</h2>
            <p className="subtle">{employee.user.email}</p>
            <p className="subtle">
              {employee.department?.name ?? "No department assigned"} ·{" "}
              {employee.employeeNumber ?? "No employee number"}
            </p>
            <div className="profile-roles">
              {employee.user.roles.map(({ role }) => (
                <Badge key={role.id}>{role.name.replaceAll("_", " ")}</Badge>
              ))}
            </div>
          </div>
        </section>
        <section className="card" style={{ marginTop: 16 }}>
          <div className="page-head">
            <div>
              <b>Assets in your custody</b>
              <p className="subtle">Current active allocations.</p>
            </div>
          </div>
          {employee.allocations.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Allocated</th>
                  <th>Expected return</th>
                </tr>
              </thead>
              <tbody>
                {employee.allocations.map((allocation) => (
                  <tr key={allocation.id}>
                    <td>
                      <b>{allocation.asset.tag}</b>
                      <div className="subtle">{allocation.asset.name}</div>
                    </td>
                    <td>{allocation.allocationDate.toLocaleDateString()}</td>
                    <td>
                      {allocation.expectedReturnDate?.toLocaleDateString() ??
                        "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle">No assets are currently assigned to you.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
