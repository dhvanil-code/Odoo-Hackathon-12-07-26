import Image from "next/image";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { requireActor } from "@/auth/access";
import { AttachmentForm } from "@/components/attachment-form";
import { ActionForm } from "@/components/action-form";
import { Shell } from "@/components/shell";
import { PageHead, Badge } from "@/components/ui";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function AssetDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor("assets:read");
  const { id } = await params;
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      category: true,
      location: true,
      owningDepartment: true,
      attachments: true,
      histories: { orderBy: { createdAt: "desc" } },
      allocations: {
        include: { employee: true, department: true },
        orderBy: { createdAt: "desc" },
      },
      transfers: { orderBy: { createdAt: "desc" } },
      returns: { orderBy: { createdAt: "desc" } },
      maintenance: { orderBy: { createdAt: "desc" } },
      bookings: { orderBy: { createdAt: "desc" } },
      auditLines: { include: { audit: true }, orderBy: { verifiedAt: "desc" } },
    },
  });
  if (!asset) notFound();
  const qr = await QRCode.toDataURL(
    `${process.env.APP_URL ?? "http://localhost:3000"}/assets/${asset.id}`,
    { margin: 1, width: 220 },
  );
  const canWrite =
    actor.roles.includes("ADMIN") || actor.roles.includes("ASSET_MANAGER");
  return (
    <Shell active="Assets">
      <div className="page">
        <PageHead
          eyebrow={asset.tag}
          title={asset.name}
          description={`${asset.category.name} · ${asset.location.name}`}
          action={
            <div className="toolbar">
              <Badge
                tone={
                  ["LOST", "UNDER_MAINTENANCE"].includes(asset.status)
                    ? "red"
                    : ""
                }
              >
                {asset.status.replaceAll("_", " ")}
              </Badge>
              {canWrite && (
                <>
                  <ActionForm
                    label="Update asset"
                    title={`Update ${asset.tag}`}
                    endpoint={`/api/assets/${asset.id}`}
                    method="PATCH"
                    fields={[
                      { name: "name", label: "Name", defaultValue: asset.name },
                      {
                        name: "condition",
                        label: "Condition",
                        type: "select",
                        defaultValue: asset.condition,
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
                        label: "Location ID",
                        defaultValue: asset.locationId,
                      },
                      {
                        name: "manufacturer",
                        label: "Manufacturer",
                        defaultValue: asset.manufacturer ?? "",
                      },
                      {
                        name: "model",
                        label: "Model",
                        defaultValue: asset.model ?? "",
                      },
                      {
                        name: "status",
                        label: "Lifecycle action",
                        type: "select",
                        options: [
                          "AVAILABLE",
                          "LOST",
                          "RETIRED",
                          "DISPOSED",
                        ].map((value) => ({ value, label: value })),
                      },
                      {
                        name: "reason",
                        label: "Reason",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                  />
                  {asset.status !== "DISPOSED" && (
                    <ActionForm
                      label="Delete asset"
                      title={`Delete ${asset.tag}?`}
                      endpoint={`/api/assets/${asset.id}`}
                      method="DELETE"
                      tone="secondary"
                      fields={[
                        {
                          name: "reason",
                          label: "Reason for deletion",
                          type: "textarea",
                          required: true,
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          }
        />
        <div className="grid-2">
          <div className="card">
            <h3>Asset profile</h3>
            <dl>
              <dt className="subtle">Serial number</dt>
              <dd>{asset.serialNumber ?? "—"}</dd>
              <dt className="subtle">Condition</dt>
              <dd>{asset.condition}</dd>
              <dt className="subtle">Owning department</dt>
              <dd>{asset.owningDepartment?.name ?? "—"}</dd>
              <dt className="subtle">Manufacturer / model</dt>
              <dd>
                {[asset.manufacturer, asset.model]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </dd>
            </dl>
          </div>
          <div className="card" style={{ textAlign: "center" }}>
            <Image
              src={qr}
              width={220}
              height={220}
              alt={`QR code for ${asset.tag}`}
            />
            <p className="subtle">Scan for mobile asset lookup</p>
          </div>
        </div>
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Attachments</h3>
          {canWrite && <AttachmentForm assetId={asset.id} />}
          <table className="table">
            <tbody>
              {asset.attachments.map((file) => (
                <tr key={file.id}>
                  <td>{file.name}</td>
                  <td>{file.mimeType}</td>
                  <td>{Math.ceil(file.size / 1024)} KB</td>
                  <td>{file.createdAt.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card" style={{ marginTop: 16 }}>
          <h3>Activity timeline</h3>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Transition</th>
                <th>Reason</th>
                <th>Workflow</th>
              </tr>
            </thead>
            <tbody>
              {asset.histories.map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt.toLocaleString()}</td>
                  <td>
                    {item.previousStatus ?? "Created"} → {item.newStatus}
                  </td>
                  <td>{item.reason}</td>
                  <td>{item.relatedType ?? "Asset"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="grid-2">
          <div className="card">
            <h3>Allocation history</h3>
            {asset.allocations.map((item) => (
              <p key={item.id}>
                {item.employee?.name ?? item.department?.name} ·{" "}
                <Badge>{item.status}</Badge>
              </p>
            ))}
          </div>
          <div className="card">
            <h3>Maintenance history</h3>
            {asset.maintenance.map((item) => (
              <p key={item.id}>
                {item.issueDescription} · <Badge>{item.status}</Badge>
              </p>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
