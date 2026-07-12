import Link from "next/link";
import { requireActor, isOrganizationWide } from "@/auth/access";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Reports() {
  const actor = await requireActor("reports:read");
  const idleCutoff = new Date();
  idleCutoff.setUTCDate(idleCutoff.getUTCDate() - 60);
  const assetWhere = isOrganizationWide(actor)
    ? {}
    : { owningDepartmentId: actor.departmentId };
  const [statusGroups, idle, maintenance, overdue, discrepancies] =
    await Promise.all([
      db.asset.groupBy({ by: ["status"], where: assetWhere, _count: true }),
      db.asset.count({
        where: {
          ...assetWhere,
          updatedAt: { lt: idleCutoff },
          status: "AVAILABLE",
        },
      }),
      db.maintenanceRequest.groupBy({ by: ["priority"], _count: true }),
      db.allocation.count({
        where: {
          overdue: true,
          status: "ACTIVE",
          ...(isOrganizationWide(actor)
            ? {}
            : { employee: { departmentId: actor.departmentId } }),
        },
      }),
      db.auditDiscrepancy.count({
        where: {
          status: { in: ["OPEN", "CONFIRMED"] },
          ...(isOrganizationWide(actor)
            ? {}
            : {
                auditLine: {
                  asset: { owningDepartmentId: actor.departmentId },
                },
              }),
        },
      }),
    ]);
  return (
    <Shell active="Reports">
      <div className="page">
        <PageHead
          eyebrow="Decision intelligence"
          title="Reports & analytics"
          description="Live utilization, lifecycle risk, maintenance, overdue, and audit indicators."
          action={
            <Link className="btn" href="/api/reports/assets.csv">
              Export assets CSV
            </Link>
          }
        />
        <div className="kpis">
          <div className="card">
            <div className="subtle">Idle assets · 60+ days</div>
            <div className="kpi-value">{idle}</div>
          </div>
          <div className="card">
            <div className="subtle">Overdue returns</div>
            <div className="kpi-value">{overdue}</div>
          </div>
          <div className="card">
            <div className="subtle">Open audit discrepancies</div>
            <div className="kpi-value">{discrepancies}</div>
          </div>
          <div className="card">
            <div className="subtle">Maintenance requests</div>
            <div className="kpi-value">
              {maintenance.reduce((total, item) => total + item._count, 0)}
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div className="card">
            <b>Assets by lifecycle status</b>
            {statusGroups.map((item) => (
              <div
                key={item.status}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "1px solid #edf0ed",
                }}
              >
                <span>{item.status.replaceAll("_", " ")}</span>
                <Badge>{item._count}</Badge>
              </div>
            ))}
          </div>
          <div className="card">
            <b>Maintenance by priority</b>
            {maintenance.map((item) => (
              <div
                key={item.priority}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "1px solid #edf0ed",
                }}
              >
                <span>{item.priority}</span>
                <Badge
                  tone={
                    item.priority === "CRITICAL"
                      ? "red"
                      : item.priority === "HIGH"
                        ? "amber"
                        : ""
                  }
                >
                  {item._count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
