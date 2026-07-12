import { requireActor, isOrganizationWide } from "@/auth/access";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
const csv = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET() {
  try {
    const actor = await requireActor("reports:read");
    const assets = await db.asset.findMany({
      where: isOrganizationWide(actor)
        ? {}
        : { owningDepartmentId: actor.departmentId },
      include: { category: true, location: true, owningDepartment: true },
      orderBy: { tag: "asc" },
    });
    const rows = [
      [
        "Tag",
        "Name",
        "Category",
        "Status",
        "Condition",
        "Location",
        "Department",
        "Acquisition cost",
      ],
      ...assets.map((asset) => [
        asset.tag,
        asset.name,
        asset.category.name,
        asset.status,
        asset.condition,
        asset.location.name,
        asset.owningDepartment?.name,
        asset.acquisitionCost,
      ]),
    ];
    await db.activityLog.create({
      data: {
        actorId: actor.userId,
        action: "REPORT_EXPORTED",
        entityType: "Asset",
        outcome: "SUCCESS",
        reason: "Asset directory CSV",
      },
    });
    return new Response(
      rows.map((row) => row.map(csv).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=assetflow-assets.csv",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
