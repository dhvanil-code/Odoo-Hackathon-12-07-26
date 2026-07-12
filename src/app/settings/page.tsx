import { requireActor } from "@/auth/access";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead } from "@/components/ui";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Settings() {
  await requireActor("org:manage");
  const values = Object.fromEntries(
    (await db.organizationSetting.findMany()).map((item) => [
      item.key,
      item.value,
    ]),
  );
  return (
    <Shell active="Settings">
      <div className="page">
        <PageHead
          eyebrow="Administration"
          title="Settings"
          description="Timezone, escalation cadence, storage, and workflow service levels."
        />
        <div className="card" style={{ maxWidth: 700 }}>
          <dl>
            <dt className="subtle">Organization timezone</dt>
            <dd>{String(values.timezone ?? "Asia/Kolkata")}</dd>
            <dt className="subtle">Overdue escalation days</dt>
            <dd>{String(values.overdueEscalationDays ?? "1, 3, 7")}</dd>
            <dt className="subtle">Maintenance SLA</dt>
            <dd>{String(values.maintenanceSlaHours ?? 24)} hours</dd>
          </dl>
          <ActionForm
            label="Edit settings"
            title="Organization settings"
            endpoint="/api/settings"
            method="PATCH"
            fields={[
              {
                name: "timezone",
                label: "IANA timezone",
                required: true,
                defaultValue: String(values.timezone ?? "Asia/Kolkata"),
              },
              {
                name: "overdueEscalationDays",
                label: "Escalation days",
                required: true,
                defaultValue: String(values.overdueEscalationDays ?? "1, 3, 7"),
              },
              {
                name: "maintenanceSlaHours",
                label: "Maintenance SLA hours",
                type: "number",
                required: true,
                defaultValue: Number(values.maintenanceSlaHours ?? 24),
              },
            ]}
          />
        </div>
      </div>
    </Shell>
  );
}
