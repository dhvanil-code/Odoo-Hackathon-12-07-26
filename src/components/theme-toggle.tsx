"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("assetflow-theme", next);
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      suppressHydrationWarning
      className="theme-toggle"
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      title={dark ? "Use light mode" : "Use dark mode"}
      onClick={toggle}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
