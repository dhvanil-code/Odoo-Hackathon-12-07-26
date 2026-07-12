"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function AttachmentForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  async function upload(data: FormData) {
    const response = await fetch(`/api/assets/${assetId}/attachments`, {
      method: "POST",
      body: data,
    });
    const payload = await response.json();
    setMessage(
      response.ok
        ? "Uploaded successfully."
        : (payload.message ?? "Upload failed."),
    );
    if (response.ok) router.refresh();
  }
  return (
    <form action={upload} className="toolbar">
      <input
        className="input"
        style={{ maxWidth: 300 }}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
        required
      />
      <button className="btn">Upload</button>
      {message && <span className="subtle">{message}</span>}
    </form>
  );
}
