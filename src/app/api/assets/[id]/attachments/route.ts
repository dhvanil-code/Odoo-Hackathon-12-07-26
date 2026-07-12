import { requireActor } from "@/auth/access";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { store } from "@/storage";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor("assets:write");
    const { id } = await context.params;
    await db.asset.findUniqueOrThrow({ where: { id } });
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File))
      return Response.json({ code: "FILE_REQUIRED" }, { status: 400 });
    const stored = await store(file);
    const attachment = await db.$transaction(async (tx) => {
      const record = await tx.assetAttachment.create({
        data: {
          assetId: id,
          name: stored.name,
          mimeType: stored.mimeType,
          size: stored.size,
          storageKey: stored.key,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.userId,
          action: "ASSET_ATTACHMENT_ADDED",
          entityType: "Asset",
          entityId: id,
          newValues: {
            name: stored.name,
            mimeType: stored.mimeType,
            size: stored.size,
          },
        },
      });
      return record;
    });
    return Response.json(attachment, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
