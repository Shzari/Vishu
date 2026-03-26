"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { StorefrontCategoryNav } from "@/components/storefront-category-nav";
import { assetUrl, apiRequest, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  getCatalogDepartmentDisplayLabel,
} from "@/lib/catalog";
import {
  buildStorefrontCategoryHref,
  getStorefrontCategoryHeading,
  getStorefrontDepartmentTitle,
  getStorefrontNavCategories,
} from "@/lib/storefront-nav";
import { ProductMedia } from "@/components/product-media";
import type { Product, PublicVendorSummary } from "@/lib/types";

type CategoryResultsMode = "category" | "new";
type SortOption = "relevance" | "newest" | "price-low" | "price-high";

const NEW_RESULTS_LIMIT = 48;

function parseListParam(value: string | null) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) ?? [];
}

function buildQueryString(
  current: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const params = new URLSearchParams(current.toString());

  Object.entries(updates).forEach(([key, value]) => {
    if (!value) {
      params.delete(key);
      return;
    }

    params.set(key, value);
  });

  const nextQuery = params.toString();
  return nextQuery ? `?${nextQuery}` : "";
}

function getDisplayGenderLabel(rawGender: string, department: string) {
  const normalized = rawGender.trim().toLowerCase();

  if (department === "kids" || department === "babies") {
    if (normalized === "male" || normalized === "men") {
      return "Boy";
    }

    if (normalized === "female" || normalized === "women") {
      return "Girl";
    }
  }

  return rawGender;
}

export function CategoryResultsPage({
  mode,
  department,
  category,
}: {
  mode: CategoryResultsMode;
  department?: string;
  category?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<PublicVendorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [minPriceDraft, setMinPriceDraft] = useState("");
  const [maxPriceDraft, setMaxPriceDraft] = useState("");

  const currentDepartment = department ?? "all";
  const currentCategory = category ?? "all";
  const selectedColors = useMemo(
    () => new Set(parseListParam(searchParams.get("colors"))),
    [searchParams],
  );
  const selectedBrands = useMemo(
    () => new Set(parseListParam(searchParams.get("brands"))),
    [searchParams],
  );
  const selectedGenders = useMemo(
    () => new Set(parseListParam(searchParams.get("genders"))),
    [searchParams],
  );
  const selectedSizes = useMemo(
    () => new Set(parseListParam(searchParams.get("sizes"))),
    [searchParams],
  );
  const selectedVendors = useMemo(
    () => new Set(parseListParam(searchParams.get("vendors"))),
    [searchParams],
  );
  const inStockOnly = searchParams.get("stock") === "in-stock";
  const sortBy = (searchParams.get("sort") as SortOption | null) ?? "relevance";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  useEffect(() => {
    async function loadProducts() {
      try {
        const [productsResult, vendorsResult] = await Promise.allSettled([
          apiRequest<Product[]>("/products"),
          apiRequest<PublicVendorSummary[]>("/products/vendors"),
        ]);

        if (productsResult.status !== "fulfilled") {
          throw productsResult.reason;
        }

        setProducts(productsResult.value);

        if (vendorsResult.status === "fulfilled") {
          setVendors(vendorsResult.value);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load category products.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
  }, []);

  useEffect(() => {
    setMinPriceDraft(minPrice);
    setMaxPriceDraft(maxPrice);
  }, [maxPrice, minPrice]);

  const baseProducts = useMemo(() => {
    const listedProducts = products.filter((product) => product.isListed !== false);

    if (mode === "new") {
      return [...listedProducts]
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, NEW_RESULTS_LIMIT);
    }

    return listedProducts.filter(
      (product) =>
        product.department === currentDepartment &&
        product.category === currentCategory,
    );
  }, [currentCategory, currentDepartment, mode, products]);

  const relatedCategories = useMemo(
    () =>
      mode === "category" ? getStorefrontNavCategories(currentDepartment) : [],
    [currentDepartment, mode],
  );
  const showGenderFilter =
    mode === "new" ||
    currentDepartment === "kids" ||
    currentDepartment === "babies";

  const vendorOptions = useMemo(() => {
    const vendors = new Map<string, string>();

    baseProducts.forEach((product) => {
      if (product.vendor?.id && product.vendor.shopName) {
        vendors.set(product.vendor.id, product.vendor.shopName);
      }
    });

    return [...vendors.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [baseProducts]);

  const brandOptions = useMemo(
    () =>
      [
        ...new Set(
          baseProducts
            .map((product) => product.brand?.name?.trim())
            .filter((entry): entry is string => Boolean(entry)),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [baseProducts],
  );

  const genderOptions = useMemo(
    () =>
      [
        ...new Set(
          baseProducts
            .map(
              (product) =>
                getDisplayGenderLabel(
                  product.genderGroup?.name?.trim() ||
                    getCatalogDepartmentDisplayLabel(product.department),
                  currentDepartment,
                ),
            )
            .filter((entry): entry is string => Boolean(entry)),
        ),
      ].sort((left, right) => left.localeCompare(right)),
    [baseProducts, currentDepartment],
  );

  const colorOptions = useMemo(
    () =>
      [
        ...new Set(
          baseProducts.flatMap((product) =>
            product.colors.length
              ? product.colors.map((entry) => entry.name)
              : product.color
                ? [product.color]
                : [],
          ),
        ),
      ]
        .sort((left, right) => left.localeCompare(right)),
    [baseProducts],
  );

  const sizeOptions = useMemo(
    () =>
      [
        ...new Set(
          baseProducts.flatMap((product) =>
            product.sizeVariants.length
              ? product.sizeVariants.map((entry) => entry.label)
              : product.size
                ? [product.size]
                : [],
          ),
        ),
      ]
        .sort((left, right) => left.localeCompare(right)),
    [baseProducts],
  );

  const filteredProducts = useMemo(() => {
    return baseProducts.filter((product) => {
      const matchesMinPrice =
        minPrice.trim().length === 0 || product.price >= Number(minPrice);
      const matchesMaxPrice =
        maxPrice.trim().length === 0 || product.price <= Number(maxPrice);
      const matchesColor =
        selectedColors.size === 0 ||
        (product.colors.length
          ? product.colors.some((entry) => selectedColors.has(entry.name))
          : product.color
            ? selectedColors.has(product.color)
            : false);
      const matchesBrand =
        selectedBrands.size === 0 ||
        (product.brand?.name ? selectedBrands.has(product.brand.name) : false);
      const matchesGender =
        !showGenderFilter ||
        selectedGenders.size === 0 ||
        selectedGenders.has(
          getDisplayGenderLabel(
            product.genderGroup?.name ||
              getCatalogDepartmentDisplayLabel(product.department),
            currentDepartment,
          ),
        );
      const matchesSize =
        selectedSizes.size === 0 ||
        (product.sizeVariants.length
          ? product.sizeVariants.some((entry) => selectedSizes.has(entry.label))
          : product.size
            ? selectedSizes.has(product.size)
            : false);
      const matchesVendor =
        selectedVendors.size === 0 ||
        (product.vendor?.id ? selectedVendors.has(product.vendor.id) : false);
      const matchesStock = !inStockOnly || product.stock > 0;

      return (
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesColor &&
        matchesBrand &&
        matchesGender &&
        matchesSize &&
        matchesVendor &&
        matchesStock
      );
    });
  }, [
    baseProducts,
    inStockOnly,
    maxPrice,
    minPrice,
    selectedBrands,
    selectedColors,
    selectedGenders,
    selectedSizes,
    selectedVendors,
    showGenderFilter,
  ]);

  const visibleProducts = useMemo(() => {
    const nextProducts = [...filteredProducts];

    switch (sortBy) {
      case "newest":
        return nextProducts.sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        );
      case "price-low":
        return nextProducts.sort((left, right) => left.price - right.price);
      case "price-high":
        return nextProducts.sort((left, right) => right.price - left.price);
      default:
        return nextProducts;
    }
  }, [filteredProducts, sortBy]);

  const pageTitle =
    mode === "new"
      ? "New Arrivals"
      : getStorefrontCategoryHeading(currentDepartment, currentCategory);
  function replaceQuery(updates: Record<string, string | null>) {
    const nextQuery = buildQueryString(searchParams, updates);
    startTransition(() => {
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    });
  }

  function toggleListFilter(
    key: "brands" | "colors" | "genders" | "sizes" | "vendors",
    value: string,
  ) {
    const currentValues = parseListParam(searchParams.get(key));
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((entry) => entry !== value)
      : [...currentValues, value];

    replaceQuery({
      [key]: nextValues.length > 0 ? nextValues.join(",") : null,
    });
  }

  function clearFilters() {
    setMinPriceDraft("");
    setMaxPriceDraft("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasActiveFilters =
    minPrice.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    selectedBrands.size > 0 ||
    selectedColors.size > 0 ||
    (showGenderFilter && selectedGenders.size > 0) ||
    selectedSizes.size > 0 ||
    selectedVendors.size > 0 ||
    inStockOnly ||
    sortBy !== "relevance";

  return (
    <div className="category-results-page">
      <StorefrontCategoryNav
        mode={mode === "new" ? "new" : "catalog"}
        currentDepartment={currentDepartment}
        currentCategory={currentCategory}
        vendors={vendors}
      />

      <div className="category-results-breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        {mode === "new" ? (
          <span>New</span>
        ) : (
          <>
            <span>{getStorefrontDepartmentTitle(currentDepartment)}</span>
            <span>/</span>
            <span>{formatCatalogLabel(currentCategory)}</span>
          </>
        )}
      </div>

      <section className="category-results-head">
        <div className="category-results-head-copy">
          <h1 className="category-results-title">{pageTitle}</h1>
        </div>

        <div className="category-results-controls">
          <button
            type="button"
            className="category-results-control"
            onClick={() => setShowFilters((current) => !current)}
          >
            {showFilters ? "Hide filters" : "Show filters"}
          </button>

          <label className="category-results-sort">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(event) =>
                replaceQuery({
                  sort:
                    event.target.value === "relevance"
                      ? null
                      : event.target.value,
                })
              }
            >
              <option value="relevance">Relevance</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
            </select>
          </label>
        </div>
      </section>

      <div
        className={
          showFilters
            ? "category-results-layout"
            : "category-results-layout filters-hidden"
        }
      >
        <div
          className={
            showFilters
              ? "category-results-sidebar-shell"
              : "category-results-sidebar-shell is-collapsed"
          }
          aria-hidden={!showFilters}
        >
          <aside className="category-results-sidebar">
            {mode === "category" ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Category</div>
                <div className="category-filter-links">
                  {relatedCategories.map((entry) => (
                    <Link
                      key={entry}
                      href={buildStorefrontCategoryHref(currentDepartment, entry)}
                      className={
                        entry === currentCategory
                          ? "category-filter-link active"
                          : "category-filter-link"
                      }
                    >
                      {formatCatalogLabel(entry)}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="category-filter-group">
              <div className="category-filter-title">Price</div>
              <form
                className="category-filter-price"
                onSubmit={(event) => {
                  event.preventDefault();
                  replaceQuery({
                    minPrice: minPriceDraft.trim() || null,
                    maxPrice: maxPriceDraft.trim() || null,
                  });
                }}
              >
                <label className="field">
                  <span>Min</span>
                  <input
                    value={minPriceDraft}
                    onChange={(event) => setMinPriceDraft(event.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>
                <label className="field">
                  <span>Max</span>
                  <input
                    value={maxPriceDraft}
                    onChange={(event) => setMaxPriceDraft(event.target.value)}
                    inputMode="decimal"
                    placeholder="500"
                  />
                </label>
                <button type="submit" className="button-secondary">
                  Apply
                </button>
              </form>
            </section>

            <section className="category-filter-group">
              <div className="category-filter-title">Availability</div>
              <label className="category-filter-check">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(event) =>
                    replaceQuery({
                      stock: event.target.checked ? "in-stock" : null,
                    })
                  }
                />
                <span>In stock only</span>
              </label>
            </section>

            {showGenderFilter && genderOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Gender</div>
                <div className="category-filter-options">
                  {genderOptions.map((entry) => (
                    <label key={entry} className="category-filter-check">
                      <input
                        type="checkbox"
                        checked={selectedGenders.has(entry)}
                        onChange={() => toggleListFilter("genders", entry)}
                      />
                      <span>{entry}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {brandOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Brand</div>
                <div className="category-filter-options">
                  {brandOptions.map((entry) => (
                    <label key={entry} className="category-filter-check">
                      <input
                        type="checkbox"
                        checked={selectedBrands.has(entry)}
                        onChange={() => toggleListFilter("brands", entry)}
                      />
                      <span>{entry}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {sizeOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Size</div>
                <div className="category-filter-options">
                  {sizeOptions.map((entry) => (
                    <label key={entry} className="category-filter-check">
                      <input
                        type="checkbox"
                        checked={selectedSizes.has(entry)}
                        onChange={() => toggleListFilter("sizes", entry)}
                      />
                      <span>{String(entry).toUpperCase()}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {colorOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Color</div>
                <div className="category-filter-options">
                  {colorOptions.map((entry) => (
                    <label key={entry} className="category-filter-check">
                      <input
                        type="checkbox"
                        checked={selectedColors.has(entry)}
                        onChange={() => toggleListFilter("colors", entry)}
                      />
                      <span>{formatCatalogLabel(entry)}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {vendorOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Brand / Vendor</div>
                <div className="category-filter-options">
                  {vendorOptions.map((entry) => (
                    <label key={entry.id} className="category-filter-check">
                      <input
                        type="checkbox"
                        checked={selectedVendors.has(entry.id)}
                        onChange={() => toggleListFilter("vendors", entry.id)}
                      />
                      <span>{entry.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                className="button-secondary category-filter-reset"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </aside>
        </div>

        <section className="category-results-main">
          {loading ? <div className="message">Loading products...</div> : null}
          {error ? <div className="message error">{error}</div> : null}

          {!loading && !error && visibleProducts.length === 0 ? (
            <div className="category-results-empty">
              <strong>No products found for this selection.</strong>
              <p>
                Adjust the filters or choose another category to keep browsing.
              </p>
            </div>
          ) : null}

          {!loading && !error && visibleProducts.length > 0 ? (
            <div className="catalog-grid category-results-grid">
              {visibleProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <Link
                    href={`/products/${product.id}`}
                    className="product-card-link"
                    aria-label={`Open ${product.title}`}
                  >
                    <div className="product-thumb">
                      <div className="product-media-shell">
                        <ProductMedia
                          image={assetUrl(product.images[0])}
                          title={product.title}
                        />
                      </div>
                    </div>
                    <div className="product-card-body">
                      <div className="product-title-link">{product.title}</div>
                      <div className="product-secondary-line">
                        {mode === "new"
                          ? `New arrival \u00b7 ${formatCatalogLabel(product.category)}`
                          : [
                              getCatalogDepartmentDisplayLabel(
                                product.department,
                              ),
                              formatCatalogLabel(product.category),
                            ]
                              .filter(Boolean)
                              .join(" \u00b7 ")}
                        {product.color
                          ? ` \u00b7 ${formatCatalogLabel(product.color)}`
                          : ""}
                        {product.size
                          ? ` \u00b7 ${String(product.size).toUpperCase()}`
                          : ""}
                      </div>
                      <div className="product-price-row product-price-row-stacked">
                        <span className="price">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
