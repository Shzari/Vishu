"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, assetUrl } from "@/lib/api";
import {
  PRODUCT_DEPARTMENTS,
  formatCatalogLabel,
  getCatalogCategoriesForDepartment,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import type { PublicVendorSummary } from "@/lib/types";

export default function ShopsPage() {
  const [vendors, setVendors] = useState<PublicVendorSummary[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [productOnly, setProductOnly] = useState(false);
  const [department, setDepartment] = useState("all");
  const [category, setCategory] = useState("all");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVendors() {
      try {
        const data = await apiRequest<PublicVendorSummary[]>("/products/vendors");
        setVendors(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load shops.");
      } finally {
        setLoading(false);
      }
    }

    void loadVendors();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      setSearch(params.get("search") ?? "");
      setDepartment(params.get("department") ?? "all");
      setCategory(params.get("category") ?? "all");
      setFiltersHydrated(true);
    };

    syncFromLocation();
    window.addEventListener("vishu-marketplace-query", syncFromLocation);
    window.addEventListener("popstate", syncFromLocation);

    return () => {
      window.removeEventListener("vishu-marketplace-query", syncFromLocation);
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, []);

  const storefrontDepartments = useMemo(
    () => PRODUCT_DEPARTMENTS.filter((entry) => entry !== "unisex"),
    [],
  );
  const categoryOptions = useMemo(
    () => ["all", ...getCatalogCategoriesForDepartment(department === "all" ? undefined : department)],
    [department],
  );

  useEffect(() => {
    if (category !== "all" && !categoryOptions.includes(category)) {
      setCategory("all");
    }
  }, [category, categoryOptions]);

  useEffect(() => {
    if (!filtersHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (department !== "all") params.set("department", department);
    if (category !== "all") params.set("category", category);
    const nextQuery = params.toString();
    const currentQuery = window.location.search.replace(/^\?/, "");

    if (nextQuery !== currentQuery) {
      window.history.replaceState({}, "", `/shops${nextQuery ? `?${nextQuery}` : ""}`);
    }
  }, [category, department, filtersHydrated, search]);

  const filteredVendors = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = vendors.filter((vendor) => {
      const matchesSearch =
        !term ||
        `${vendor.shopName} ${vendor.shopDescription ?? ""}`.toLowerCase().includes(term);
      const matchesProductState = !productOnly || vendor.productCount > 0;
      const matchesDepartment =
        department === "all" || vendor.departments.includes(department);
      const matchesCategory =
        category === "all" || vendor.categories.includes(category);

      return matchesSearch && matchesProductState && matchesDepartment && matchesCategory;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "name") {
        return left.shopName.localeCompare(right.shopName);
      }

      if (sortBy === "categories") {
        return right.categoryCount - left.categoryCount;
      }

      if (right.productCount !== left.productCount) {
        return right.productCount - left.productCount;
      }

      return left.shopName.localeCompare(right.shopName);
    });
  }, [category, department, productOnly, search, sortBy, vendors]);

  return (
    <div className="stack">
      <section className="storefront-banner">
        <div>
          <div className="storefront-label">Marketplace shops</div>
          <h1 className="storefront-title">Browse every public vendor in one place.</h1>
          <p className="storefront-copy">
            Open a specific shop when you already know where you want to buy.
          </p>
        </div>
      </section>

      <section className="form-card stack">
        <div className="chip-row">
          <button
            type="button"
            className={department === "all" ? "chip active" : "chip"}
            onClick={() => {
              setDepartment("all");
              setCategory("all");
            }}
          >
            All {getCatalogGenderLabel(true).toLowerCase()}
          </button>
          {storefrontDepartments.map((entry) => (
            <button
              key={entry}
              type="button"
              className={department === entry ? "chip active" : "chip"}
              onClick={() => {
                setDepartment(entry);
                setCategory("all");
              }}
            >
              {formatCatalogLabel(entry)}
            </button>
          ))}
        </div>

        {department !== "all" && (
          <div className="shop-filter-chips">
            {categoryOptions.map((entry) => (
              <button
                key={entry}
                type="button"
                className={category === entry ? "chip active" : "chip"}
                onClick={() => setCategory(entry)}
              >
                {entry === "all" ? `All ${formatCatalogLabel(department)}` : formatCatalogLabel(entry)}
              </button>
            ))}
          </div>
        )}

        <div className="advanced-filter-grid">
          <div className="field">
            <label>Search shops</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Shop name or description"
            />
          </div>
          <div className="field">
            <label>Sort shops</label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="featured">Most products</option>
              <option value="categories">Most categories</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={productOnly}
            onChange={(event) => setProductOnly(event.target.checked)}
          />
          <span>Only show shops that currently have public products</span>
        </label>

        <div className="catalog-browse-summary">
          <div className="chip-row">
            {search.trim() ? <span className="chip">Search: {search.trim()}</span> : null}
            {department !== "all" ? (
              <span className="chip">{getCatalogGenderLabel()}: {formatCatalogLabel(department)}</span>
            ) : null}
            {category !== "all" ? <span className="chip">{formatCatalogLabel(category)}</span> : null}
            {productOnly ? <span className="chip">With products only</span> : null}
            <span className="chip">{filteredVendors.length} shops</span>
          </div>
          {(search.trim() || department !== "all" || category !== "all" || productOnly) && (
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setSearch("");
                setDepartment("all");
                setCategory("all");
                setProductOnly(false);
              }}
            >
              Clear shop filters
            </button>
          )}
        </div>
      </section>

      {loading && <div className="message">Loading shops...</div>}
      {error && <div className="message error">{error}</div>}
      {!loading && !error && filteredVendors.length === 0 && <div className="empty">No shops match your search.</div>}

      <section className="shops-grid">
        {filteredVendors.map((vendor) => (
          <Link key={vendor.id} href={`/shops/${vendor.id}`} className="shop-card">
            <div className="shop-card-visual">
              {vendor.logoUrl ? (
                <img src={assetUrl(vendor.logoUrl)} alt={vendor.shopName} />
              ) : (
                <div className="shop-card-fallback">{vendor.shopName.slice(0, 1)}</div>
              )}
            </div>
            <div className="shop-card-body">
              <strong>{vendor.shopName}</strong>
              <p className="muted">
                {vendor.shopDescription?.slice(0, 110) || "Open this shop to see its current marketplace catalog."}
              </p>
              <div className="chip-row">
                <span className="chip">{vendor.productCount} products</span>
                <span className="chip">{vendor.categoryCount} categories</span>
                {vendor.categories.slice(0, 2).map((entry) => (
                  <span key={`${vendor.id}-${entry}`} className="chip">
                    {formatCatalogLabel(entry)}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
