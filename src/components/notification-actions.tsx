"use client";
import { useRouter } from "next/navigation";
export function NotificationActions({ id }: { id?: string }) {
  const router = useRouter();
  async function mark() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    router.refresh();
  }
  return (
    <button className="btn secondary" onClick={mark}>
      {id ? "Mark read" : "Mark all read"}
    </button>
  );
}
