"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers";

export type VendorWorkspaceSection =
  | "dashboard"
  | "orders"
  | "products"
  | "inventory"
  | "earnings"
  | "settings";

const VENDOR_WORKSPACE_LINKS: Array<{
  id: VendorWorkspaceSection;
  label: string;
  href: string;
}> = [
  { id: "dashboard", label: "Dashboard", href: "/vendor/dashboard" },
  { id: "orders", label: "Orders", href: "/vendor/orders" },
  { id: "products", label: "Products", href: "/vendor/products" },
  { id: "inventory", label: "Inventory", href: "/vendor/inventory" },
  { id: "earnings", label: "Earnings", href: "/vendor/earnings" },
  { id: "settings", label: "Settings", href: "/vendor/settings" },
];

export function VendorWorkspaceShell({
  section,
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  section: VendorWorkspaceSection;
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const vendorAccessRole = profile?.vendor?.access_role ?? "shop_holder";
  const visibleLinks = VENDOR_WORKSPACE_LINKS.filter((link) => {
    if (vendorAccessRole === "employee") {
      return link.id !== "earnings" && link.id !== "settings";
    }

    return true;
  });

  return (
    <div className="vendor-workspace-page">
      <div className="vendor-workspace-layout">
        <aside className="vendor-workspace-sidebar">
          <nav className="vendor-sidebar-nav" aria-label="Vendor workspace">
            {visibleLinks.map((link) => {
              const isActive =
                section === link.id ||
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className={
                    isActive
                      ? "vendor-sidebar-link active"
                      : "vendor-sidebar-link"
                  }
                >
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="vendor-workspace-main">
          <section className="vendor-page-head">
            <div className="vendor-page-copy">
              {eyebrow ? <span className="vendor-page-eyebrow">{eyebrow}</span> : null}
              <h1 className="vendor-page-title">{title}</h1>
              {description ? (
                <p className="vendor-page-description">{description}</p>
              ) : null}
            </div>
            {actions ? <div className="vendor-page-actions">{actions}</div> : null}
          </section>

          <div className="vendor-workspace-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
