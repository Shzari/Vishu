"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminWorkspaceSection =
  | "dashboard"
  | "vendors"
  | "customers"
  | "promotions"
  | "requests"
  | "reports"
  | "fees"
  | "settings";

const ADMIN_WORKSPACE_LINKS: Array<{
  id: AdminWorkspaceSection;
  label: string;
  href: string;
}> = [
  { id: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
  { id: "vendors", label: "Vendors", href: "/admin/vendors" },
  { id: "customers", label: "Customers", href: "/admin/customers" },
  { id: "promotions", label: "Promotions", href: "/admin/promotions" },
  { id: "requests", label: "Requests", href: "/admin/requests" },
  { id: "reports", label: "Reports", href: "/admin/reports" },
  { id: "fees", label: "Vendor Fees", href: "/admin/fees" },
  { id: "settings", label: "Settings", href: "/admin/settings" },
];

function getActiveSection(pathname: string): AdminWorkspaceSection {
  if (pathname.startsWith("/admin/vendors")) return "vendors";
  if (pathname.startsWith("/admin/customers")) return "customers";
  if (pathname.startsWith("/admin/users")) return "customers";
  if (pathname.startsWith("/admin/orders")) return "reports";
  if (pathname.startsWith("/admin/promotions")) return "promotions";
  if (pathname.startsWith("/admin/requests")) return "requests";
  if (pathname.startsWith("/admin/reports")) return "reports";
  if (pathname.startsWith("/admin/fees")) return "fees";
  if (pathname.startsWith("/admin/settings")) return "settings";
  return "dashboard";
}

export function AdminWorkspaceFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const activeSection = getActiveSection(pathname);

  return (
    <div className="admin-workspace-frame">
      <div className="admin-workspace-layout">
        <aside className="admin-workspace-sidebar">
          <nav className="admin-sidebar-nav" aria-label="Admin workspace">
            {ADMIN_WORKSPACE_LINKS.map((link) => {
              const isActive =
                activeSection === link.id ||
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className={
                    isActive ? "admin-sidebar-link active" : "admin-sidebar-link"
                  }
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="admin-workspace-main">{children}</div>
      </div>
    </div>
  );
}
