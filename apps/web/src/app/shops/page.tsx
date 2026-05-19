"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, assetUrl } from "@/lib/api";
import { filterCatalogCategories, formatCatalogLabel } from "@/lib/catalog";
import { RatingStars } from "@/components/rating-stars";
import type { PublicVendorSummary } from "@/lib/types";

export default function ShopsPage() {
  const [vendors, setVendors] = useState<PublicVendorSummary[]>([]);
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

  const activeVendors = useMemo(() => {
    return vendors
      .map((vendor) => ({
        vendor,
        categories: filterCatalogCategories(vendor.categories),
      }))
      .sort((left, right) => {
        if (right.vendor.productCount !== left.vendor.productCount) {
          return right.vendor.productCount - left.vendor.productCount;
        }

        return left.vendor.shopName.localeCompare(right.vendor.shopName);
      });
  }, [vendors]);

  const vendorCategoryMap = useMemo(
    () =>
      new Map(
        activeVendors.map(({ vendor, categories }) => [vendor.id, categories]),
      ),
    [activeVendors],
  );

  return (
    <div className="shops-page stack">
      {loading && <div className="message">Loading shops...</div>}
      {error && <div className="message error">{error}</div>}
      {!loading && !error ? (
        <section className="shops-directory-head">
          <div className="shops-directory-copy">
            <h1>All shops</h1>
          </div>
        </section>
      ) : null}

      {!loading && !error && activeVendors.length === 0 && (
        <div className="empty">No active shops yet.</div>
      )}

      <section className="shops-grid">
        {activeVendors.map(({ vendor }) => {
          const visibleCategories = vendorCategoryMap.get(vendor.id) ?? [];

          return (
          <Link
            key={vendor.id}
            href={`/shops/${vendor.id}`}
            className={vendor.productCount > 0 ? "shop-card" : "shop-card shop-card-empty"}
          >
            <div
              className="shop-card-visual"
              style={
                vendor.bannerUrl
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.48)), url(${assetUrl(vendor.bannerUrl)})`,
                    }
                  : undefined
              }
            >
              {vendor.logoUrl ? (
                <Image
                  src={assetUrl(vendor.logoUrl)}
                  alt={vendor.shopName}
                  width={112}
                  height={112}
                  unoptimized
                />
              ) : (
                <div className="shop-card-fallback">{vendor.shopName.slice(0, 1)}</div>
              )}
              <span className="shop-card-status">{vendor.productCount > 0 ? "Open shop" : "Coming soon"}</span>
            </div>
            <div className="shop-card-body">
              <div className="shop-card-title-row">
                <strong>{vendor.shopName}</strong>
              </div>
              <RatingStars
                value={vendor.ratingSummary.average}
                count={vendor.ratingSummary.count}
                size="sm"
                className="shop-card-rating"
              />
              <p className="muted">
                {vendor.shopDescription?.slice(0, 110) || "Open this shop to see its current marketplace catalog."}
              </p>
              <div className="shop-card-meta">
                <span>
                  {vendor.productCount > 0
                    ? `${visibleCategories.length} categories`
                    : "Coming soon"}
                </span>
                <span>
                  {vendor.productCount > 0
                    ? vendor.departments.map((entry) => formatCatalogLabel(entry)).slice(0, 2).join(" / ") || "All styles"
                    : "0 products"}
                </span>
              </div>
              <div className="shop-card-tags">
                {vendor.productCount > 0 ? (
                  <>
                    {visibleCategories.slice(0, 2).map((entry) => (
                      <span key={`${vendor.id}-${entry}`} className="chip">
                        {formatCatalogLabel(entry)}
                      </span>
                    ))}
                    {visibleCategories.length > 2 ? <span className="chip">+{visibleCategories.length - 2} more</span> : null}
                  </>
                ) : (
                  <span className="chip">No products yet</span>
                )}
              </div>
            </div>
          </Link>
          );
        })}
      </section>
    </div>
  );
}
