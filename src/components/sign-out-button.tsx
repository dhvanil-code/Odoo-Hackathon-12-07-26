"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ initials }: { initials: string }) {
  return (
    <button
      className="avatar-button"
      aria-label="Sign out"
      title="Sign out"
      onClick={() => {
        if (window.confirm("Sign out of AssetFlow?"))
          void signOut({ callbackUrl: "/login" });
      }}
    >
      <span className="avatar-initials">{initials}</span>
    </button>
  );
}
