"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCatalogLabel } from "@/lib/catalog";
import {
  STOREFRONT_NAV_GROUPS,
  buildStorefrontCategoryHref,
  formatStorefrontNavCategoryLabel,
  getStorefrontNavCategories,
  getStorefrontNavGroup,
} from "@/lib/storefront-nav";

export function StorefrontCategoryNav({
  mode,
  currentDepartment,
  currentCategory,
}: {
  mode: "catalog" | "new";
  currentDepartment: string;
  currentCategory: string;
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
            (currentDepartment === group.id ||
              (group.id === "accessories" &&
                currentDepartment === "all" &&
                currentCategory !== "all"));

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
                isMobileNav &&
                group.department &&
                group.id !== "accessories"
                  ? browseDepartment(group.department)
                  : previewNavGroup(group.id)
              }
            >
              <span>{formatCatalogLabel(group.label.toLowerCase())}</span>
            </button>
          );
        })}
      </div>

      <div
        className={
          isNavMenuOpen && activeNavGroup
            ? "storefront-submenu-panel is-open"
            : "storefront-submenu-panel"
        }
        aria-hidden={!isNavMenuOpen || !activeNavGroup}
      >
        {activeNavGroup ? (
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
                  <span>{formatStorefrontNavCategoryLabel(activeNavGroup.id, entry)}</span>
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
