"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { FavoriteStarButton } from "@/components/favorite-star-button";
import { StorefrontCategoryNav } from "@/components/storefront-category-nav";
import { assetUrl, apiRequest, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  getCatalogSizeFilterOptions,
  isAccessoryProduct,
} from "@/lib/catalog";
import {
  buildStorefrontCategoryHref,
  formatStorefrontNavCategoryLabel,
  getStorefrontCategoryHeading,
  getStorefrontDepartmentTitle,
  getStorefrontNavCategories,
} from "@/lib/storefront-nav";
import { ProductMedia } from "@/components/product-media";
import type { Product } from "@/lib/types";

type CategoryResultsMode = "category" | "new";
type SortOption = "relevance" | "newest" | "price-low" | "price-high" | "title" | "vendor";
type CatalogBrandOption = { id: string; name: string };

const NEW_RESULTS_LIMIT = 48;
const NEW_ARRIVAL_DAYS = 30;
const COLLAPSED_FILTER_OPTION_LIMIT = 5;

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

function getProductVendorName(product: Product) {
  return product.vendor?.shopName?.trim() || "Vendor";
}

function normalizeSizeOption(value: string) {
  return value.trim().toLowerCase();
}

function getProductCategoryKeys(product: Product) {
  return [product.category, product.categoryRef?.name, product.subcategory?.name]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
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
  const { addItem } = useCart();
  const { currentRole, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogBrands, setCatalogBrands] = useState<CatalogBrandOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedFilterGroups, setExpandedFilterGroups] = useState<
    Record<string, boolean>
  >({});
  const [minPriceDraft, setMinPriceDraft] = useState("");
  const [maxPriceDraft, setMaxPriceDraft] = useState("");

  const currentDepartment = department ?? "all";
  const currentCategory = category ?? "all";
  const isDepartmentBrowse = mode === "category" && currentCategory === "all";
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
  const selectedSizeKeys = useMemo(
    () => new Set([...selectedSizes].map(normalizeSizeOption)),
    [selectedSizes],
  );
  const inStockOnly = searchParams.get("stock") === "in-stock";
  const sortBy = (searchParams.get("sort") as SortOption | null) ?? "relevance";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  useEffect(() => {
    async function loadProducts() {
      try {
        const productsResult = await apiRequest<Product[]>("/products");
        setProducts(productsResult);
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

    void apiRequest<CatalogBrandOption[]>("/products/catalog/brands")
      .then(setCatalogBrands)
      .catch(() => {
        setCatalogBrands([]);
      });
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    setShowFilters(!mediaQuery.matches);
  }, [pathname]);

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowFilters(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showFilters]);

  useEffect(() => {
    setMinPriceDraft(minPrice);
    setMaxPriceDraft(maxPrice);
  }, [maxPrice, minPrice]);

  const baseProducts = useMemo(() => {
    const listedProducts = products.filter((product) => product.isListed !== false);

    if (mode === "new") {
      const cutoff = Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000;
      return [...listedProducts]
        .filter((product) => new Date(product.createdAt).getTime() >= cutoff)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, NEW_RESULTS_LIMIT);
    }

    return listedProducts.filter((product) => {
      if (currentDepartment === "all") {
        return isDepartmentBrowse
          ? isAccessoryProduct(product)
          : getProductCategoryKeys(product).includes(currentCategory);
      }

      return (
        product.department === currentDepartment &&
        (isDepartmentBrowse || product.category === currentCategory)
      );
    });
  }, [currentCategory, currentDepartment, isDepartmentBrowse, mode, products]);

  const relatedCategories = useMemo(
    () =>
      mode === "category"
        ? getStorefrontNavCategories(
            currentDepartment === "all" ? "accessories" : currentDepartment,
          )
        : [],
    [currentDepartment, mode],
  );
  const showGenderFilter =
    mode === "new" ||
    currentDepartment === "all" ||
    currentDepartment === "kids" ||
    currentDepartment === "babies";

  const brandOptions = useMemo(
    () => {
      const nextOptions = new Map<string, string>();

      catalogBrands.forEach((entry) => {
        nextOptions.set(entry.name.trim().toLowerCase(), entry.name);
      });

      baseProducts
        .map((product) => product.brand?.name?.trim())
        .filter((entry): entry is string => Boolean(entry))
        .forEach((entry) => {
          const key = entry.trim().toLowerCase();
          if (!nextOptions.has(key)) {
            nextOptions.set(key, entry);
          }
        });

      return [...nextOptions.values()].sort((left, right) =>
        left.localeCompare(right),
      );
    },
    [baseProducts, catalogBrands],
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
    () => {
      const nextOptions = new Map<string, string>();

      getCatalogSizeFilterOptions(currentDepartment, currentCategory).forEach(
        (entry) => {
          nextOptions.set(normalizeSizeOption(entry), entry);
        },
      );

      baseProducts
        .flatMap((product) =>
          product.sizeVariants.length
            ? product.sizeVariants.map((entry) => entry.label)
            : product.size
              ? [product.size]
              : [],
        )
        .forEach((entry) => {
          const key = normalizeSizeOption(entry);
          if (!nextOptions.has(key)) {
            nextOptions.set(key, entry);
          }
        });

      return [...nextOptions.values()];
    },
    [baseProducts, currentCategory, currentDepartment],
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
          ? product.sizeVariants.some((entry) =>
              selectedSizeKeys.has(normalizeSizeOption(entry.label)),
            )
          : product.size
            ? selectedSizeKeys.has(normalizeSizeOption(product.size))
            : false);
      const matchesStock = !inStockOnly || product.stock > 0;

      return (
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesColor &&
        matchesBrand &&
        matchesGender &&
        matchesSize &&
        matchesStock
      );
    });
  }, [
    baseProducts,
    currentDepartment,
    inStockOnly,
    maxPrice,
    minPrice,
    selectedBrands,
    selectedColors,
    selectedGenders,
    selectedSizeKeys,
    selectedSizes,
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
      case "title":
        return nextProducts.sort((left, right) => left.title.localeCompare(right.title));
      case "vendor":
        return nextProducts.sort(
          (left, right) =>
            getProductVendorName(left).localeCompare(getProductVendorName(right)) ||
            left.title.localeCompare(right.title),
        );
      default:
        return nextProducts;
    }
  }, [filteredProducts, sortBy]);

  const pageTitle =
    mode === "new"
      ? "New Arrivals"
      : isDepartmentBrowse
        ? `${getStorefrontDepartmentTitle(currentDepartment)} Products`
      : getStorefrontCategoryHeading(currentDepartment, currentCategory);

  function replaceQuery(updates: Record<string, string | null>) {
    const nextQuery = buildQueryString(searchParams, updates);
    startTransition(() => {
      router.replace(`${pathname}${nextQuery}`, { scroll: false });
    });
  }

  function toggleListFilter(
    key: "brands" | "colors" | "genders" | "sizes",
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

  function toggleFilterGroup(group: string) {
    setExpandedFilterGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }

  function getVisibleFilterOptions(
    group: string,
    options: string[],
    isSelected: (value: string) => boolean,
  ) {
    if (expandedFilterGroups[group] || options.length <= COLLAPSED_FILTER_OPTION_LIMIT) {
      return options;
    }

    const selectedOptions = options.filter(isSelected);
    const visibleOptions = [
      ...selectedOptions,
      ...options.filter((entry) => !isSelected(entry)),
    ];

    return visibleOptions.slice(0, COLLAPSED_FILTER_OPTION_LIMIT);
  }

  function renderExpandableFilterOptions({
    group,
    options,
    isSelected,
    onToggle,
    formatLabel = (value: string) => value,
  }: {
    group: string;
    options: string[];
    isSelected: (value: string) => boolean;
    onToggle: (value: string) => void;
    formatLabel?: (value: string) => string;
  }) {
    const visibleOptions = getVisibleFilterOptions(group, options, isSelected);
    const expanded = Boolean(expandedFilterGroups[group]);

    return (
      <>
        <div className="category-filter-options">
          {visibleOptions.map((entry) => (
            <label key={entry} className="category-filter-check">
              <input
                type="checkbox"
                checked={isSelected(entry)}
                onChange={() => onToggle(entry)}
              />
              <span>{formatLabel(entry)}</span>
            </label>
          ))}
        </div>
        {options.length > COLLAPSED_FILTER_OPTION_LIMIT ? (
          <button
            type="button"
            className="category-filter-more"
            onClick={() => toggleFilterGroup(group)}
          >
            {expanded ? "Show less" : `Show all ${options.length}`}
          </button>
        ) : null}
      </>
    );
  }

  const hasActiveFilters =
    minPrice.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    selectedBrands.size > 0 ||
    selectedColors.size > 0 ||
    (showGenderFilter && selectedGenders.size > 0) ||
    selectedSizes.size > 0 ||
    inStockOnly ||
    sortBy !== "relevance";

  return (
    <div className="category-results-page">
      <StorefrontCategoryNav
        mode={mode === "new" ? "new" : "catalog"}
        currentDepartment={currentDepartment}
        currentCategory={currentCategory}
      />

      <div className="category-results-breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        {mode === "new" ? (
          <span>New</span>
        ) : (
          <>
            <span>{getStorefrontDepartmentTitle(currentDepartment)}</span>
            {isDepartmentBrowse ? null : (
              <>
                <span>/</span>
                <span>{formatCatalogLabel(currentCategory)}</span>
              </>
            )}
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
            {showFilters ? "Close filters" : "Filter"}
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
              <option value="price-low">Price ↑</option>
              <option value="price-high">Price ↓</option>
              <option value="title">A-Z</option>
              <option value="vendor">Vendor</option>
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
          onClick={() => setShowFilters(false)}
        >
          <aside
            className="category-results-sidebar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="category-filter-drawer-head">
              <strong>Filters</strong>
              <button
                type="button"
                className="category-filter-drawer-close"
                onClick={() => setShowFilters(false)}
              >
                Close
              </button>
            </div>

            {mode === "category" ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Category</div>
                <div className="category-filter-links">
                  <Link
                    href={buildStorefrontCategoryHref(currentDepartment, "all")}
                    className={
                      isDepartmentBrowse
                        ? "category-filter-link active"
                        : "category-filter-link"
                    }
                    onClick={() => setShowFilters(false)}
                  >
                    All
                  </Link>
                  {relatedCategories.map((entry) => (
                    <Link
                      key={entry}
                      href={buildStorefrontCategoryHref(currentDepartment, entry)}
                      className={
                        entry === currentCategory
                          ? "category-filter-link active"
                          : "category-filter-link"
                      }
                      onClick={() => setShowFilters(false)}
                    >
                      {formatStorefrontNavCategoryLabel(
                        currentDepartment === "all" ? "accessories" : currentDepartment,
                        entry,
                      )}
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
                {renderExpandableFilterOptions({
                  group: "genders",
                  options: genderOptions,
                  isSelected: (entry) => selectedGenders.has(entry),
                  onToggle: (entry) => toggleListFilter("genders", entry),
                })}
              </section>
            ) : null}

            {brandOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Brand</div>
                {renderExpandableFilterOptions({
                  group: "brands",
                  options: brandOptions,
                  isSelected: (entry) => selectedBrands.has(entry),
                  onToggle: (entry) => toggleListFilter("brands", entry),
                })}
              </section>
            ) : null}

            {sizeOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Size</div>
                {renderExpandableFilterOptions({
                  group: "sizes",
                  options: sizeOptions,
                  isSelected: (entry) =>
                    selectedSizeKeys.has(normalizeSizeOption(entry)),
                  onToggle: (entry) => toggleListFilter("sizes", entry),
                  formatLabel: formatProductAttributeLabel,
                })}
              </section>
            ) : null}

            {colorOptions.length > 0 ? (
              <section className="category-filter-group">
                <div className="category-filter-title">Color</div>
                {renderExpandableFilterOptions({
                  group: "colors",
                  options: colorOptions,
                  isSelected: (entry) => selectedColors.has(entry),
                  onToggle: (entry) => toggleListFilter("colors", entry),
                  formatLabel: formatCatalogLabel,
                })}
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
              {visibleProducts.map((product) => {
                const isOwnVendorProduct =
                  currentRole === "vendor" && product.vendor?.id === profile?.vendor?.id;

                return (
                <article key={product.id} className="product-card">
                  <FavoriteStarButton product={product} className="product-card-favorite" />
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
                      <div
                        className={
                          product.stock > 0
                            ? "product-stock-line"
                            : "product-stock-line product-stock-line-empty"
                        }
                      >
                        {product.stock > 0
                          ? "Available now"
                          : "Currently unavailable"}
                      </div>
                    </div>
                  </Link>
                  <div className="product-card-foot">
                    {product.vendor ? (
                      <Link
                        className="product-card-vendor"
                        href={`/shops/${product.vendor.id}`}
                      >
                        {product.vendor.shopName}
                      </Link>
                    ) : (
                      <span className="product-card-vendor muted">
                        Marketplace listing
                      </span>
                    )}
                    <div className="product-card-actions">
                      <Link
                        className="product-action-button product-action-button-secondary"
                        href={`/products/${product.id}`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        className="product-action-button button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const variant = product.sizeVariants.find((entry) => entry.stock > 0);
                          addItem({
                            productId: product.id,
                            vendorId: product.vendor?.id ?? null,
                            sizeId: variant?.id ?? null,
                            title: product.title,
                            price: product.price,
                            image: product.images[0],
                            color: product.color ?? product.colors[0]?.name ?? null,
                            size: variant?.label ?? product.size ?? null,
                            quantity: 1,
                            stock: variant?.stock ?? product.stock,
                          });
                        }}
                        disabled={product.stock === 0 || isOwnVendorProduct}
                      >
                        {product.stock === 0
                          ? "Sold out"
                          : isOwnVendorProduct
                            ? "Your product"
                            : "Add to cart"}
                      </button>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
