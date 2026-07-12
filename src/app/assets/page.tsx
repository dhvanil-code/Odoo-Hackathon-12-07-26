import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { requireActor, isOrganizationWide } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Assets({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const actor = await requireActor("assets:read");
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page ?? 1) || 1);
  const where: Prisma.AssetWhereInput = {
    AND: [
      ...(filters.q
        ? [
            {
              OR: [
                { tag: { contains: filters.q } },
                { name: { contains: filters.q } },
                { serialNumber: { contains: filters.q } },
              ],
            },
          ]
        : []),
      ...(filters.status
        ? [{ status: filters.status as Prisma.EnumAssetStatusFilter }]
        : []),
      ...(filters.category ? [{ categoryId: filters.category }] : []),
      ...(!isOrganizationWide(actor)
        ? [
            {
              OR: [
                { owningDepartmentId: actor.departmentId },
                {
                  allocations: {
                    some: actor.roles.includes("DEPARTMENT_HEAD")
                      ? { employee: { departmentId: actor.departmentId } }
                      : { employeeId: actor.employeeId },
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };
  const [assets, total, categories, locations, departments] = await Promise.all(
    [
      db.asset.findMany({
        where,
        include: {
          category: true,
          location: true,
          owningDepartment: true,
          allocations: {
            where: { status: "ACTIVE", actualReturnDate: null },
            include: { employee: true, department: true },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * 50,
        take: 50,
      }),
      db.asset.count({ where }),
      db.assetCategory.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      }),
      db.location.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      }),
      db.department.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
      }),
    ],
  );
  const canRegister =
    actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
  return (
    <Shell active="Assets">
      <div className="page">
        <PageHead
          eyebrow="Asset registry"
          title="Assets"
          description="Searchable asset directory with current custody and lifecycle state."
          action={
            canRegister ? (
              <ActionForm
                label="+ Register asset"
                title="Register asset"
                endpoint="/api/admin/assets"
                fields={[
                  { name: "name", label: "Asset name", required: true },
                  {
                    name: "categoryId",
                    label: "Category",
                    type: "select",
                    required: true,
                    options: categories.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  },
                  { name: "serialNumber", label: "Serial number" },
                  {
                    name: "condition",
                    label: "Condition",
                    type: "select",
                    required: true,
                    defaultValue: "GOOD",
                    options: [
                      "NEW",
                      "EXCELLENT",
                      "GOOD",
                      "FAIR",
                      "DAMAGED",
                      "UNUSABLE",
                    ].map((value) => ({ value, label: value })),
                  },
                  {
                    name: "locationId",
                    label: "Location",
                    type: "select",
                    required: true,
                    options: locations.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  },
                  {
                    name: "owningDepartmentId",
                    label: "Owning department",
                    type: "select",
                    options: departments.map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  },
                  { name: "manufacturer", label: "Manufacturer" },
                  { name: "model", label: "Model" },
                  {
                    name: "acquisitionCost",
                    label: "Acquisition cost",
                    type: "number",
                  },
                  {
                    name: "shared",
                    label: "Shared/bookable resource",
                    type: "checkbox",
                  },
                  { name: "notes", label: "Notes", type: "textarea" },
                ]}
              />
            ) : undefined
          }
        />
        <form className="toolbar">
          <input
            className="input search"
            name="q"
            defaultValue={filters.q}
            placeholder="Search tag, serial number, or name"
          />
          <select
            className="select"
            name="category"
            defaultValue={filters.category ?? ""}
            style={{ width: 180 }}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            name="status"
            defaultValue={filters.status ?? ""}
            style={{ width: 170 }}
          >
            <option value="">All statuses</option>
            {[
              "AVAILABLE",
              "ALLOCATED",
              "RESERVED",
              "UNDER_MAINTENANCE",
              "LOST",
              "RETIRED",
              "DISPOSED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <button className="btn secondary">Apply filters</button>
        </form>
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Current holder</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => {
                  const allocation = asset.allocations[0];
                  return (
                    <tr key={asset.id}>
                      <td>
                        <Link href={`/assets/${asset.id}`}>
                          <b>{asset.tag}</b>
                        </Link>
                      </td>
                      <td>{asset.name}</td>
                      <td>{asset.category.name}</td>
                      <td>
                        <Badge
                          tone={
                            ["LOST", "UNDER_MAINTENANCE"].includes(asset.status)
                              ? "red"
                              : asset.status === "RESERVED"
                                ? "amber"
                                : ""
                          }
                        >
                          {asset.status.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td>
                        {allocation?.employee?.name ??
                          allocation?.department?.name ??
                          "—"}
                      </td>
                      <td>{asset.location.name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {assets.length === 0 && (
              <p className="subtle">No assets match these filters.</p>
            )}
          </div>
          <div className="toolbar" style={{ justifyContent: "space-between" }}>
            <p className="subtle">
              Showing {total === 0 ? 0 : (page - 1) * 50 + 1}–
              {Math.min(page * 50, total)} of {total} assets
            </p>
            <div className="toolbar">
              {page > 1 && (
                <Link
                  className="btn secondary"
                  href={{
                    pathname: "/assets",
                    query: { ...filters, page: page - 1 },
                  }}
                >
                  Previous
                </Link>
              )}
              {page * 50 < total && (
                <Link
                  className="btn secondary"
                  href={{
                    pathname: "/assets",
                    query: { ...filters, page: page + 1 },
                  }}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
