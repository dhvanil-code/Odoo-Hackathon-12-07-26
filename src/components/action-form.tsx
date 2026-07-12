"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "textarea"
    | "select"
    | "checkbox";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | boolean;
};

export function ActionForm({
  label,
  title,
  endpoint,
  method = "POST",
  fields,
  tone = "primary",
}: {
  label: string;
  title: string;
  endpoint: string;
  method?: "POST" | "PATCH" | "DELETE";
  fields: FormField[];
  tone?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const router = useRouter();
  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(undefined);
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = formData.get(field.name);
      if (
        field.required &&
        (value === null || (typeof value === "string" && !value.trim()))
      ) {
        setMessage(`Please provide ${field.label}.`);
        setBusy(false);
        return;
      }
      if (field.type === "checkbox") body[field.name] = value === "on";
      else if (value !== null && value !== "")
        body[field.name] = field.type === "number" ? Number(value) : value;
    }
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.message ?? "The operation failed.");
      setBusy(false);
      return;
    }
    setMessage("Saved successfully.");
    setBusy(false);
    router.refresh();
    setTimeout(() => setOpen(false), 450);
  }
  return (
    <>
      <button
        type="button"
        className={`btn ${tone === "secondary" ? "secondary" : ""}`}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpen(false)
          }
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="modal-head">
              <div>
                <div className="eyebrow">AssetFlow workflow</div>
                <h2>{title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <form action={submit}>
              {fields.map((field) => (
                <label className="field" key={field.name}>
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      className="input"
                      name={field.name}
                      required={field.required}
                      defaultValue={String(field.defaultValue ?? "")}
                      rows={4}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="select"
                      name={field.name}
                      required={field.required}
                      defaultValue={String(field.defaultValue ?? "")}
                    >
                      <option value="">Select…</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <input
                      name={field.name}
                      type="checkbox"
                      defaultChecked={Boolean(field.defaultValue)}
                    />
                  ) : (
                    <input
                      className="input"
                      name={field.name}
                      type={field.type ?? "text"}
                      required={field.required}
                      defaultValue={String(field.defaultValue ?? "")}
                    />
                  )}
                </label>
              ))}
              {message && (
                <p
                  className={
                    message.includes("success") ? "form-success" : "form-error"
                  }
                  role="status"
                >
                  {message}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button className="btn" disabled={busy}>
                  {busy ? "Saving…" : "Confirm"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
