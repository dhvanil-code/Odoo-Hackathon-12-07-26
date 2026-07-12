import {
  Boxes,
  PackageCheck,
  Wrench,
  CalendarCheck,
  ArrowRightLeft,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { requireActor } from "@/auth/access";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function Dashboard() {
  await requireActor();
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
  const [
    available,
    allocated,
    maintenance,
    activeBookings,
    transfers,
    upcoming,
    overdue,
    activity,
  ] = await Promise.all([
    db.asset.count({
      where: { status: "AVAILABLE" },
    }),
    db.allocation.count({
      where: { status: "ACTIVE", actualReturnDate: null },
    }),
    db.maintenanceRequest.count({
      where: {
        status: { in: ["APPROVED", "TECHNICIAN_ASSIGNED", "IN_PROGRESS"] },
      },
    }),
    db.resourceBooking.count({
      where: {
        status: { in: ["UPCOMING", "ONGOING"] },
      },
    }),
    db.transferRequest.count({
      where: {
        status: "REQUESTED",
      },
    }),
    db.allocation.count({
      where: {
        status: "ACTIVE",
        expectedReturnDate: {
          gte: now,
          lte: nextWeek,
        },
      },
    }),
    db.allocation.count({
      where: { status: "ACTIVE", overdue: true },
    }),
    db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const kpis = [
    ["Assets available", String(available), "Ready for allocation", Boxes],
    ["Assets allocated", String(allocated), "Active custody", PackageCheck],
    [
      "Maintenance active",
      String(maintenance),
      "Approved or in progress",
      Wrench,
    ],
    [
      "Active bookings",
      String(activeBookings),
      "Upcoming or ongoing",
      CalendarCheck,
    ],
    [
      "Pending transfers",
      String(transfers),
      "Awaiting approval",
      ArrowRightLeft,
    ],
    ["Upcoming returns", String(upcoming), "Next 7 days", Clock],
    ["Overdue returns", String(overdue), "Follow-up required", TriangleAlert],
  ] as const;
  return (
    <Shell>
      <div className="page">
        <PageHead
          eyebrow={new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(
            new Date(),
          )}
          title="Operational overview"
          description="Live values from the AssetFlow system of record."
        />
        <section className="kpis">
          {kpis.map(([label, value, note, Icon]) => (
            <div className="card kpi" key={label}>
              <div className="subtle">{label}</div>
              <div className="kpi-value">{value}</div>
              <div className="subtle">{note}</div>
              <div className="kpi-icon">
                <Icon size={18} />
              </div>
            </div>
          ))}
        </section>
        <section className="grid-2">
          <div className="card">
            <b>Asset distribution</b>
            <p className="subtle">Current operational utilization</p>
            <div className="chart">
              {[
                available,
                allocated,
                maintenance,
                activeBookings,
                transfers,
                upcoming,
                overdue,
              ].map((value, index) => (
                <div
                  className="bar"
                  key={index}
                  style={{
                    height: `${Math.max(8, Math.min(100, value * 4))}%`,
                    opacity: 0.55 + index * 0.06,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="card">
            <b>Attention queue</b>
            {[
              ["Overdue returns", overdue, "red"],
              ["Maintenance active", maintenance, "amber"],
              ["Transfer approvals", transfers, ""],
            ].map(([label, value, tone]) => (
              <div
                key={String(label)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "14px 0",
                  borderBottom: "1px solid #edf0ed",
                }}
              >
                <span>{label}</span>
                <Badge tone={String(tone)}>{value}</Badge>
              </div>
            ))}
          </div>
        </section>
        <section className="card" style={{ marginTop: 16 }}>
          <b>Recent activity</b>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>When</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.action.replaceAll("_", " ")}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.createdAt.toLocaleString()}</td>
                    <td>
                      <Badge tone={entry.outcome === "SUCCESS" ? "" : "red"}>
                        {entry.outcome}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
