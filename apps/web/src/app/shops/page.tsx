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

  const filteredVendors = useMemo(() => {
    return vendors
      .filter((vendor) => vendor.productCount > 0)
      .sort((left, right) => {
        if (right.productCount !== left.productCount) {
          return right.productCount - left.productCount;
        }

        return left.shopName.localeCompare(right.shopName);
      });
  }, [vendors]);

  const vendorCategoryMap = useMemo(
    () =>
      new Map(
        filteredVendors.map((vendor) => [vendor.id, filterCatalogCategories(vendor.categories)]),
      ),
    [filteredVendors],
  );

  return (
    <div className="shops-page stack">
      {loading && <div className="message">Loading shops...</div>}
      {error && <div className="message error">{error}</div>}
      {!loading && !error && filteredVendors.length === 0 && <div className="empty">No active shops yet.</div>}

      <section className="shops-grid">
        {filteredVendors.map((vendor) => {
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
                <span>{vendor.productCount} items</span>
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
                <span>{visibleCategories.length} categories</span>
                <span>{vendor.departments.map((entry) => formatCatalogLabel(entry)).slice(0, 2).join(" / ") || "All styles"}</span>
              </div>
              <div className="shop-card-tags">
                {visibleCategories.slice(0, 2).map((entry) => (
                  <span key={`${vendor.id}-${entry}`} className="chip">
                    {formatCatalogLabel(entry)}
                  </span>
                ))}
                {visibleCategories.length > 2 ? <span className="chip">+{visibleCategories.length - 2} more</span> : null}
              </div>
            </div>
          </Link>
          );
        })}
      </section>
    </div>
  );
}
