import Link from "next/link";
import type { RoleName } from "@prisma/client";
import {
  LayoutDashboard,
  Boxes,
  ArrowRightLeft,
  CalendarDays,
  Wrench,
  ClipboardCheck,
  BarChart3,
  Bell,
  Building2,
  Users,
  ScrollText,
  Settings,
  Search,
} from "lucide-react";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  [
    "Dashboard",
    "/dashboard",
    LayoutDashboard,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE", "AUDITOR"],
  ],
  ["Organization", "/organization", Building2, ["ADMIN"]],
  ["Employees", "/employees", Users, ["ADMIN", "DEPARTMENT_HEAD"]],
  [
    "Assets",
    "/assets",
    Boxes,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE", "AUDITOR"],
  ],
  [
    "Allocation & transfers",
    "/allocations",
    ArrowRightLeft,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  ],
  [
    "Resource booking",
    "/bookings",
    CalendarDays,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  ],
  [
    "Maintenance",
    "/maintenance",
    Wrench,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE"],
  ],
  [
    "Audits",
    "/audits",
    ClipboardCheck,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "AUDITOR"],
  ],
  [
    "Reports",
    "/reports",
    BarChart3,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"],
  ],
  [
    "Notifications",
    "/notifications",
    Bell,
    ["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD", "EMPLOYEE", "AUDITOR"],
  ],
  ["Activity logs", "/activity", ScrollText, ["ADMIN", "ASSET_MANAGER"]],
  ["Settings", "/settings", Settings, ["ADMIN"]],
] as const;

export async function Shell({
  children,
  active = "Dashboard",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const session = await auth();
  const roles = session?.user.roles ?? ([] as RoleName[]);
  const initials =
    session?.user.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "AF";
  const roleLabel =
    roles.map((role) => role.replaceAll("_", " ")).join(" · ") || "Employee";
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>AssetFlow</span>
        </div>
        <div className="nav-group">Workspace</div>
        {nav
          .filter(([, , , allowed]) =>
            roles.some((role) => (allowed as readonly string[]).includes(role)),
          )
          .map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${active === label ? "active" : ""}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        <Link
          href="/profile"
          className="sidebar-foot"
          aria-label="Open profile"
        >
          <b style={{ fontSize: 12 }}>{roleLabel}</b>
          <div style={{ fontSize: 10, color: "#a9bcb4", marginTop: 4 }}>
            {session?.user.name ?? "Signed in"}
          </div>
        </Link>
      </aside>
      <main className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Search size={17} />
            <span className="subtle">Search assets, people, or tags…</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ThemeToggle />
            <Link href="/notifications" aria-label="Notifications">
              <Bell size={18} />
            </Link>
            <SignOutButton initials={initials} />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
