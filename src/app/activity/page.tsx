import { requireActor } from "@/auth/access";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Activity() {
  await requireActor("logs:read");
  const logs = await db.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <Shell active="Activity logs">
      <div className="page">
        <PageHead
          eyebrow="Immutable ledger"
          title="Activity logs"
          description="Actor, outcome, reason, and correlation context for accountable actions."
        />
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Reason</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt.toLocaleString()}</td>
                  <td>{log.action.replaceAll("_", " ")}</td>
                  <td>
                    {log.entityType}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                  </td>
                  <td>{log.reason ?? "—"}</td>
                  <td>
                    <Badge tone={log.outcome === "SUCCESS" ? "" : "red"}>
                      {log.outcome}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
