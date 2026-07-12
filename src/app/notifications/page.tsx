import { requireActor } from "@/auth/access";
import { NotificationActions } from "@/components/notification-actions";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Notifications() {
  const actor = await requireActor();
  const notifications = await db.notification.findMany({
    where: { recipientId: actor.employeeId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <Shell active="Notifications">
      <div className="page">
        <PageHead
          eyebrow="Inbox"
          title="Notifications"
          description="Persistent assignments, approvals, reminders, discrepancies, and escalations."
          action={<NotificationActions />}
        />
        <div className="card">
          {notifications.map((item) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                padding: 16,
                borderBottom: "1px solid #edf0ed",
                opacity: item.readAt?.getTime() ? 0.6 : 1,
              }}
            >
              <div>
                <b>{item.title}</b>
                <div className="subtle" style={{ marginTop: 5 }}>
                  {item.message}
                </div>
              </div>
              <div className="toolbar">
                <Badge
                  tone={
                    item.severity === "ERROR"
                      ? "red"
                      : item.severity === "WARNING"
                        ? "amber"
                        : ""
                  }
                >
                  {item.createdAt.toLocaleString()}
                </Badge>
                {!item.readAt && <NotificationActions id={item.id} />}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="subtle">No notifications.</p>
          )}
        </div>
      </div>
    </Shell>
  );
}
