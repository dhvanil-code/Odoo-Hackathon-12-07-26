import { requireActor } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Organization() {
  await requireActor("org:manage");
  const [departments, categories, employees] = await Promise.all([
    db.department.findMany({
      include: {
        parent: true,
        head: true,
        _count: { select: { employees: true, assets: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.assetCategory.findMany({
      include: { attributes: true, _count: { select: { assets: true } } },
      orderBy: { name: "asc" },
    }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <Shell active="Organization">
      <div className="page">
        <PageHead
          eyebrow="Admin only"
          title="Organization setup"
          description="Departments, hierarchy, asset taxonomy, and employee ownership."
          action={
            <ActionForm
              label="+ Add department"
              title="Create department"
              endpoint="/api/admin/departments"
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "code", label: "Code", required: true },
                { name: "description", label: "Description", type: "textarea" },
                {
                  name: "parentId",
                  label: "Parent department",
                  type: "select",
                  options: departments.map((department) => ({
                    value: department.id,
                    label: department.name,
                  })),
                },
                {
                  name: "headId",
                  label: "Department head",
                  type: "select",
                  options: employees.map((employee) => ({
                    value: employee.id,
                    label: employee.name,
                  })),
                },
              ]}
            />
          }
        />
        <div className="tabs">
          <div className="tab active">Departments</div>
          <div className="tab">Asset categories</div>
          <div className="tab">Employee directory</div>
        </div>
        <section className="card">
          <div className="page-head">
            <div>
              <b>Department hierarchy</b>
              <p className="subtle">
                Inactive units retain history but cannot receive new
                allocations.
              </p>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Parent</th>
                <th>Head</th>
                <th>Employees</th>
                <th>Assets</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id}>
                  <td>{department.name}</td>
                  <td>{department.code}</td>
                  <td>{department.parent?.name ?? "—"}</td>
                  <td>{department.head?.name ?? "—"}</td>
                  <td>{department._count.employees}</td>
                  <td>{department._count.assets}</td>
                  <td>
                    <Badge tone={department.status === "INACTIVE" ? "red" : ""}>
                      {department.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card" style={{ marginTop: 16 }}>
          <div className="page-head">
            <div>
              <b>Asset categories</b>
              <p className="subtle">Validated category-specific attributes.</p>
            </div>
            <ActionForm
              label="+ Add category"
              title="Create asset category"
              endpoint="/api/admin/categories"
              fields={[
                { name: "name", label: "Name", required: true },
                { name: "code", label: "Code", required: true },
                { name: "description", label: "Description", type: "textarea" },
              ]}
            />
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Code</th>
                <th>Assets</th>
                <th>Attributes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>{category.name}</td>
                  <td>{category.code}</td>
                  <td>{category._count.assets}</td>
                  <td>
                    {category.attributes
                      .map((attribute) => attribute.name)
                      .join(", ") || "—"}
                  </td>
                  <td>
                    <Badge>{category.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  );
}
