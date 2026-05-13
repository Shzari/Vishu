"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assetUrl } from "@/lib/api";
import { formatCatalogLabel } from "@/lib/catalog";
import {
  STOREFRONT_NAV_GROUPS,
  buildStorefrontCategoryHref,
  getStorefrontNavCategories,
  getStorefrontNavGroup,
} from "@/lib/storefront-nav";
import type { PublicVendorSummary } from "@/lib/types";

export function StorefrontCategoryNav({
  mode,
  currentDepartment,
  currentCategory,
  vendors,
}: {
  mode: "catalog" | "new";
  currentDepartment: string;
  currentCategory: string;
  vendors: PublicVendorSummary[];
}) {
  const router = useRouter();
  const [activeNavGroupId, setActiveNavGroupId] = useState<string | null>(null);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);

  const activeNavGroup = useMemo(
    () =>
      activeNavGroupId === null ? null : getStorefrontNavGroup(activeNavGroupId),
    [activeNavGroupId],
  );
  const activeNavCategories = useMemo(
    () => (activeNavGroup ? getStorefrontNavCategories(activeNavGroup.id) : []),
    [activeNavGroup],
  );
  const vendorMenuEntries = useMemo(
    () =>
      [...vendors].sort((left, right) =>
        left.shopName.localeCompare(right.shopName),
      ),
    [vendors],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const syncMobileNav = () => setIsMobileNav(mediaQuery.matches);

    syncMobileNav();
    mediaQuery.addEventListener("change", syncMobileNav);

    return () => {
      mediaQuery.removeEventListener("change", syncMobileNav);
    };
  }, []);

  function previewNavGroup(groupId: string) {
    setActiveNavGroupId(groupId);
    setIsNavMenuOpen(true);
  }

  function closeNavGroupPreview() {
    setIsNavMenuOpen(false);
  }

  function browseDepartmentCategory(
    nextDepartment: string,
    nextCategory: string,
  ) {
    setIsNavMenuOpen(false);
    router.push(buildStorefrontCategoryHref(nextDepartment, nextCategory));
  }

  function browseDepartment(nextDepartment: string) {
    browseDepartmentCategory(nextDepartment, "all");
  }

  function browseNewArrivals() {
    setIsNavMenuOpen(false);
    router.push("/new");
  }

  return (
    <section
      className="storefront-browse-stage category-results-nav-shell"
      onMouseLeave={closeNavGroupPreview}
    >
      <div
        className="storefront-department-bar"
        role="tablist"
        aria-label="Browse categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "new"}
          className={
            mode === "new"
              ? "storefront-department-tab active"
              : "storefront-department-tab"
          }
          onMouseEnter={closeNavGroupPreview}
          onFocus={closeNavGroupPreview}
          onClick={browseNewArrivals}
        >
          <span>New</span>
        </button>

        {STOREFRONT_NAV_GROUPS.map((group) => {
          const isActive =
            mode === "catalog" &&
            currentDepartment === group.id;

          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive
                  ? "storefront-department-tab active"
                  : "storefront-department-tab"
              }
              onMouseEnter={() => {
                if (!isMobileNav) {
                  previewNavGroup(group.id);
                }
              }}
              onFocus={() => {
                if (!isMobileNav) {
                  previewNavGroup(group.id);
                }
              }}
              onClick={() =>
                isMobileNav && group.department
                  ? browseDepartment(group.department)
                  : previewNavGroup(group.id)
              }
            >
              <span>{formatCatalogLabel(group.label.toLowerCase())}</span>
            </button>
          );
        })}

        <button
          type="button"
          role="tab"
          aria-selected={false}
          className="storefront-department-tab"
          onMouseEnter={() => {
            if (!isMobileNav) {
              previewNavGroup("vendors");
            }
          }}
          onFocus={() => {
            if (!isMobileNav) {
              previewNavGroup("vendors");
            }
          }}
          onClick={() => {
            previewNavGroup("vendors");
          }}
        >
          <span>Vendors</span>
        </button>
      </div>

      <div
        className={
          isNavMenuOpen && (activeNavGroupId === "vendors" || activeNavGroup)
            ? "storefront-submenu-panel is-open"
            : "storefront-submenu-panel"
        }
        aria-hidden={
          !isNavMenuOpen || (!activeNavGroup && activeNavGroupId !== "vendors")
        }
      >
        {activeNavGroupId === "vendors" ? (
          <div
            className="storefront-submenu-list storefront-submenu-list-vendors"
            role="tabpanel"
            aria-label="Vendor shops"
          >
            {vendorMenuEntries.length === 0 ? (
              <div className="storefront-submenu-note">
                Public shops will appear here as vendors go live.
              </div>
            ) : (
              vendorMenuEntries.map((vendor) => {
                const vendorImage = vendor.logoUrl ?? vendor.bannerUrl ?? undefined;

                return (
                  <Link
                    key={vendor.id}
                    href={`/shops/${vendor.id}`}
                    className="storefront-submenu-link storefront-submenu-link-vendor"
                    onClick={closeNavGroupPreview}
                  >
                    <span
                      className="storefront-submenu-vendor-image"
                      style={
                        vendorImage
                          ? {
                              backgroundImage: `url(${assetUrl(vendorImage)})`,
                            }
                          : undefined
                      }
                      aria-hidden="true"
                    >
                      {vendorImage ? null : vendor.shopName.slice(0, 1)}
                    </span>
                    <span>{vendor.shopName}</span>
                  </Link>
                );
              })
            )}
          </div>
        ) : activeNavGroup ? (
          <div
            className="storefront-submenu-list"
            role="tabpanel"
            aria-label={`${activeNavGroup.label} categories`}
          >
            {activeNavGroup.available && activeNavGroup.department ? null : (
              <div className="storefront-submenu-note">
                Kids and babies categories are prepared for the next catalog
                expansion.
              </div>
            )}

            {activeNavCategories.map((entry) => {
              const canBrowse =
                activeNavGroup.available && Boolean(activeNavGroup.department);
              const isActive =
                canBrowse &&
                mode === "catalog" &&
                currentDepartment === activeNavGroup.department &&
                currentCategory === entry;

              return (
                <button
                  key={`${activeNavGroup.id}-${entry}`}
                  type="button"
                  className={
                    isActive
                      ? "storefront-submenu-link active"
                      : "storefront-submenu-link"
                  }
                  onClick={() =>
                    canBrowse && activeNavGroup.department
                      ? browseDepartmentCategory(activeNavGroup.department, entry)
                      : undefined
                  }
                  disabled={!canBrowse}
                >
                  <span>{formatCatalogLabel(entry)}</span>
                  <strong>&gt;</strong>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
