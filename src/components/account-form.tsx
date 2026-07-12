"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AccountForm({
  mode,
  token,
}: {
  mode: "signup" | "forgot" | "reset";
  token?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string>();
  async function submit(data: FormData) {
    const endpoint =
      mode === "signup"
        ? "/api/signup"
        : mode === "forgot"
          ? "/api/password/forgot"
          : "/api/password/reset";
    const body = Object.fromEntries(data);
    if (mode === "reset") body.token = token ?? "";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(
      payload.message ??
        (response.ok ? "Saved successfully." : "Request failed."),
    );
    if (response.ok && mode !== "forgot")
      setTimeout(() => router.push("/login"), 700);
  }
  return (
    <form action={submit}>
      {mode === "signup" && (
        <>
          <label className="field">
            Full name
            <input className="input" name="name" required minLength={2} />
          </label>
          <label className="field">
            Employee number (optional)
            <input className="input" name="employeeNumber" />
          </label>
        </>
      )}
      {mode !== "reset" && (
        <label className="field">
          Work email
          <input className="input" name="email" type="email" required />
        </label>
      )}
      {mode !== "forgot" && (
        <label className="field">
          New password
          <input
            className="input"
            name="password"
            type="password"
            required
            minLength={12}
          />
        </label>
      )}
      <button className="btn" style={{ width: "100%" }}>
        {mode === "signup"
          ? "Create employee account"
          : mode === "forgot"
            ? "Request reset"
            : "Set new password"}
      </button>
      {message && (
        <p className="subtle" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
