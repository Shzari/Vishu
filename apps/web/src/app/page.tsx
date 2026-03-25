"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  getCatalogCategoriesForDepartment,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import { ProductMedia } from "@/components/product-media";
import type {
  HomepageHeroConfig,
  Product,
  ProductSearchResponse,
  PublicVendorSummary,
} from "@/lib/types";

const STOREFRONT_NAV_GROUPS = [
  {
    id: "men",
    label: "MEN",
    department: "men",
    available: true,
    note: "Refined daily staples, tailoring, and outerwear.",
    subcategories: [
      "tshirts",
      "shirts",
      "hoodies",
      "jackets",
      "jeans",
      "pants",
      "outerwear",
      "sportswear",
    ],
  },
  {
    id: "women",
    label: "WOMEN",
    department: "women",
    available: true,
    note: "Dresses, elevated essentials, and seasonal layers.",
    subcategories: [
      "dresses",
      "tops",
      "jackets",
      "shirts",
      "jeans",
      "skirts",
      "leggings",
      "accessories",
    ],
  },
  {
    id: "kids",
    label: "KIDS",
    available: false,
    note: "Structured kidswear navigation is prepared for the next catalog expansion.",
    subcategories: [
      "tshirts",
      "hoodies",
      "jackets",
      "sets",
      "jeans",
      "pants",
      "schoolwear",
      "sleepwear",
    ],
  },
  {
    id: "babies",
    label: "BABIES",
    available: false,
    note: "Soft essentials, newborn sets, and nursery basics are coming into the catalog.",
    subcategories: [
      "bodysuits",
      "rompers",
      "sets",
      "outerwear",
      "sleepwear",
      "blankets",
      "accessories",
      "gift sets",
    ],
  },
] as const;

type StorefrontNavGroup = (typeof STOREFRONT_NAV_GROUPS)[number];

function applyCatalogFilters(
  items: Product[],
  filters: {
    department: string;
    category: string;
    minPrice: string;
    maxPrice: string;
    color: string;
    size: string;
  },
) {
  return items.filter((product) => {
    const matchesDepartment =
      filters.department === "all" || product.department === filters.department;
    const matchesCategory =
      filters.category === "all" || product.category === filters.category;
    const matchesMinPrice =
      filters.minPrice.trim().length === 0 ||
      product.price >= Number(filters.minPrice);
    const matchesMaxPrice =
      filters.maxPrice.trim().length === 0 ||
      product.price <= Number(filters.maxPrice);
    const matchesColor = filters.color === "all" || product.color === filters.color;
    const matchesSize = filters.size === "all" || product.size === filters.size;

    return (
      matchesDepartment &&
      matchesCategory &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesColor &&
      matchesSize
    );
  });
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<PublicVendorSummary[]>([]);
  const [homepageHero, setHomepageHero] = useState<HomepageHeroConfig>({
    autoRotate: true,
    intervalSeconds: 6,
    slides: [],
  });
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null,
  );
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<
    string | undefined
  >();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductSearchResponse | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [category, setCategory] = useState("all");
  const [activeNavGroupId, setActiveNavGroupId] = useState<string>("men");
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [color, setColor] = useState("all");
  const [size, setSize] = useState("all");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const { addItem } = useCart();

  useEffect(() => {
    async function loadProducts() {
      try {
        const [productData, vendorData, heroData] = await Promise.all([
          apiRequest<Product[]>("/products"),
          apiRequest<PublicVendorSummary[]>("/products/vendors"),
          apiRequest<HomepageHeroConfig>("/homepage-hero"),
        ]);
        setProducts(productData);
        setVendors(vendorData);
        setHomepageHero(heroData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load products.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProducts();
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
      setMinPrice(params.get("minPrice") ?? "");
      setMaxPrice(params.get("maxPrice") ?? "");
      setColor(params.get("color") ?? "all");
      setSize(params.get("size") ?? "all");
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

  useEffect(() => {
    if (!filtersHydrated || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (department !== "all") params.set("department", department);
    if (category !== "all") params.set("category", category);
    if (minPrice.trim()) params.set("minPrice", minPrice.trim());
    if (maxPrice.trim()) params.set("maxPrice", maxPrice.trim());
    if (color !== "all") params.set("color", color);
    if (size !== "all") params.set("size", size);

    const nextQuery = params.toString();
    const currentQuery = window.location.search.replace(/^\?/, "");

    if (nextQuery !== currentQuery) {
      window.history.replaceState(
        {},
        "",
        `/${nextQuery ? `?${nextQuery}` : ""}`,
      );
    }
  }, [
    category,
    color,
    department,
    filtersHydrated,
    maxPrice,
    minPrice,
    search,
    size,
  ]);

  useEffect(() => {
    if (!filtersHydrated) {
      return;
    }

    if (!search.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      setError(null);
      return;
    }

    let active = true;

    async function loadSearchResults() {
      try {
        setSearchLoading(true);
        setError(null);
        const params = new URLSearchParams({ query: search.trim(), limit: "24" });
        if (department !== "all") {
          params.set("department", department);
        }
        if (category !== "all") {
          params.set("category", category);
        }

        const response = await apiRequest<ProductSearchResponse>(
          `/products/search?${params.toString()}`,
        );

        if (active) {
          setSearchResults(response);
        }
      } catch (searchError) {
        if (active) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Failed to search products.",
          );
          setSearchResults(null);
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }

    void loadSearchResults();

    return () => {
      active = false;
    };
  }, [category, department, filtersHydrated, search]);

  const categories = useMemo(
    () => ["all", ...getCatalogCategoriesForDepartment(department)],
    [department],
  );
  const categoryScopedProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesDepartment =
          department === "all" || product.department === department;
        const matchesCategory =
          category === "all" || product.category === category;

        return matchesDepartment && matchesCategory;
      }),
    [category, department, products],
  );
  const availableColors = useMemo(
    () =>
      [
        ...new Set(
          categoryScopedProducts
            .map((product) => product.color)
            .filter(Boolean),
        ),
      ].map((entry) => String(entry)),
    [categoryScopedProducts],
  );
  const availableSizes = useMemo(
    () =>
      [
        ...new Set(
          categoryScopedProducts.map((product) => product.size).filter(Boolean),
        ),
      ].map((entry) => String(entry)),
    [categoryScopedProducts],
  );

  useEffect(() => {
    if (category !== "all" && !categories.includes(category)) {
      setCategory("all");
    }
  }, [categories, category]);

  useEffect(() => {
    if (color !== "all" && !availableColors.includes(color)) {
      setColor("all");
    }
  }, [availableColors, color]);

  useEffect(() => {
    if (size !== "all" && !availableSizes.includes(size)) {
      setSize("all");
    }
  }, [availableSizes, size]);

  const filteredProducts = useMemo(
    () =>
      applyCatalogFilters(products, {
        department,
        category,
        minPrice,
        maxPrice,
        color,
        size,
      }),
    [category, color, department, maxPrice, minPrice, products, size],
  );
  const visibleSearchSections = useMemo(
    () =>
      (searchResults?.sections ?? [])
        .map((section) => ({
          ...section,
          products: applyCatalogFilters(section.products, {
            department,
            category,
            minPrice,
            maxPrice,
            color,
            size,
          }),
        }))
        .filter((section) => section.products.length > 0),
    [
      category,
      color,
      department,
      maxPrice,
      minPrice,
      searchResults,
      size,
    ],
  );
  const fallbackSearchProducts = useMemo(() => {
    const visibleIds = new Set(
      visibleSearchSections.flatMap((section) =>
        section.products.map((product) => product.id),
      ),
    );

    return applyCatalogFilters(searchResults?.fallbackProducts ?? [], {
      department,
      category,
      minPrice,
      maxPrice,
      color,
      size,
    }).filter((product) => !visibleIds.has(product.id));
  }, [
    category,
    color,
    department,
    maxPrice,
    minPrice,
    searchResults,
    size,
    visibleSearchSections,
  ]);
  const displayProducts = useMemo(() => {
    if (!search.trim()) {
      return filteredProducts;
    }

    const orderedMatches = visibleSearchSections.flatMap(
      (section) => section.products,
    );
    return orderedMatches.length > 0 ? orderedMatches : fallbackSearchProducts;
  }, [
    fallbackSearchProducts,
    filteredProducts,
    search,
    visibleSearchSections,
  ]);
  const searchSectionLabel = visibleSearchSections
    .map((section) => section.title)
    .join(" -> ");
  const showingFallbackProducts =
    search.trim().length > 0 &&
    visibleSearchSections.length === 0 &&
    fallbackSearchProducts.length > 0;
  const hasFocusedBrowse =
    department !== "all" || category !== "all" || search.trim().length > 0;

  const featuredVendors = useMemo(() => {
    const relevantVendors = vendors.filter((vendor) => {
      const matchesDepartment =
        department === "all" || vendor.departments.includes(department);
      const matchesCategory =
        category === "all" || vendor.categories.includes(category);

      return matchesDepartment && matchesCategory;
    });
    const shuffled = [
      ...(relevantVendors.length > 0 ? relevantVendors : vendors),
    ];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index],
      ];
    }

    return shuffled.slice(0, 8);
  }, [category, department, vendors]);
  const activeHeroSlide = homepageHero.slides[activeHeroIndex] ?? null;
  const activeNavGroup = useMemo<StorefrontNavGroup>(
    () =>
      STOREFRONT_NAV_GROUPS.find((entry) => entry.id === activeNavGroupId) ??
      STOREFRONT_NAV_GROUPS[0],
    [activeNavGroupId],
  );
  const activeNavCategories = useMemo(
    () =>
      activeNavGroup.available && activeNavGroup.department
        ? getCatalogCategoriesForDepartment(activeNavGroup.department)
        : [...activeNavGroup.subcategories],
    [activeNavGroup],
  );
  useEffect(() => {
    if (!quickViewProduct) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickViewProduct(null);
        setSelectedQuickViewImage(undefined);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [quickViewProduct]);

  useEffect(() => {
    if (!quickViewProduct || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [quickViewProduct]);

  useEffect(() => {
    setActiveHeroIndex(0);
  }, [homepageHero.slides.length]);

  useEffect(() => {
    if (!homepageHero.autoRotate || homepageHero.slides.length <= 1) {
      return;
    }

    const intervalMs = Math.max(homepageHero.intervalSeconds, 3) * 1000;
    const timer = window.setInterval(() => {
      setActiveHeroIndex(
        (current) => (current + 1) % homepageHero.slides.length,
      );
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [
    homepageHero.autoRotate,
    homepageHero.intervalSeconds,
    homepageHero.slides.length,
  ]);

  useEffect(() => {
    if (department === "men" || department === "women") {
      setActiveNavGroupId(department);
    }
  }, [department]);

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
    setDepartment(nextDepartment);
    setCategory(nextCategory);
    setActiveNavGroupId(nextDepartment);
    setIsNavMenuOpen(false);
  }

  function closeQuickView() {
    setQuickViewProduct(null);
    setSelectedQuickViewImage(undefined);
  }

  function showPreviousHeroSlide() {
    if (homepageHero.slides.length <= 1) {
      return;
    }

    setActiveHeroIndex(
      (current) =>
        (current - 1 + homepageHero.slides.length) % homepageHero.slides.length,
    );
  }

  function showNextHeroSlide() {
    if (homepageHero.slides.length <= 1) {
      return;
    }

    setActiveHeroIndex((current) => (current + 1) % homepageHero.slides.length);
  }


  function clearBrowseFilters() {
    setDepartment("all");
    setCategory("all");
    setMinPrice("");
    setMaxPrice("");
    setColor("all");
    setSize("all");
  }

  return (
    <div className="storefront">
      <section className="storefront-top-layout">
        <div
          className="storefront-browse-stage"
          onMouseLeave={closeNavGroupPreview}
        >
          <div
            className="storefront-department-bar"
            role="tablist"
            aria-label="Browse categories"
          >
            {STOREFRONT_NAV_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                role="tab"
                aria-selected={
                  (group.id === "men" || group.id === "women") &&
                  department === group.id &&
                  category !== "all"
                }
                className={
                  (group.id === "men" || group.id === "women") &&
                  department === group.id &&
                  category !== "all"
                    ? "storefront-department-tab active"
                    : "storefront-department-tab"
                }
                onMouseEnter={() => previewNavGroup(group.id)}
                onFocus={() => previewNavGroup(group.id)}
                onClick={() => previewNavGroup(group.id)}
              >
                <span>{formatCatalogLabel(group.label.toLowerCase())}</span>
              </button>
            ))}
          </div>
          <div
            className={
              isNavMenuOpen
                ? "storefront-submenu-panel is-open"
                : "storefront-submenu-panel"
            }
            aria-hidden={!isNavMenuOpen}
          >
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
                  activeNavGroup.available &&
                  Boolean(activeNavGroup.department);
                const isActive =
                  canBrowse &&
                  department === activeNavGroup.department &&
                  category === entry;

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
                        ? browseDepartmentCategory(
                            activeNavGroup.department,
                            entry,
                          )
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
          </div>
        </div>

        <section className="storefront-hero-stage storefront-promotion-stage">
          {homepageHero.slides.length > 1 ? (
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-left"
              onClick={showPreviousHeroSlide}
              aria-label="Show previous promotion"
            >
              ‹
            </button>
          ) : null}

          {activeHeroSlide ? (
            <a
              className="storefront-promotion-link"
              href={activeHeroSlide.targetUrl || "/#posted-products"}
            >
              <div className="storefront-promotion-frame">
                <picture className="storefront-promotion-picture">
                  {activeHeroSlide.mobileImageUrl ? (
                    <source
                      media="(max-width: 640px)"
                      srcSet={assetUrl(activeHeroSlide.mobileImageUrl)}
                    />
                  ) : null}
                  <img
                    src={
                      activeHeroSlide.imageUrl
                        ? assetUrl(activeHeroSlide.imageUrl)
                        : ""
                    }
                    alt={activeHeroSlide.internalName || "Homepage promotion"}
                  />
                </picture>
              </div>
            </a>
          ) : (
            <div className="storefront-hero-placeholder storefront-promotion-placeholder">
              <span>Vishu.shop</span>
              <strong>Promotion space ready</strong>
              <p>
                Upload homepage banners from the admin Promotions section to
                launch campaigns here.
              </p>
            </div>
          )}

          {homepageHero.slides.length > 1 ? (
            <button
              type="button"
              className="hero-carousel-arrow hero-carousel-arrow-right"
              onClick={showNextHeroSlide}
              aria-label="Show next promotion"
            >
              ›
            </button>
          ) : null}

          {homepageHero.slides.length > 1 ? (
            <div className="storefront-hero-dots storefront-promotion-dots">
              {homepageHero.slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  className={
                    index === activeHeroIndex
                      ? "storefront-hero-dot active"
                      : "storefront-hero-dot"
                  }
                  onClick={() => setActiveHeroIndex(index)}
                  aria-label={`Show promotion ${index + 1}`}
                />
              ))}
            </div>
          ) : null}
        </section>

      </section>

      <section id="posted-products" className="catalog-main">
        <div className="catalog-browse-summary">
          <div className="chip-row">
            {search.trim() ? (
              <span className="chip">Search: {search.trim()}</span>
            ) : null}
            {department !== "all" ? (
              <span className="chip">{formatCatalogLabel(department)}</span>
            ) : null}
            {category !== "all" ? (
              <span className="chip">{formatCatalogLabel(category)}</span>
            ) : null}
            {color !== "all" ? (
              <span className="chip">Color: {formatCatalogLabel(color)}</span>
            ) : null}
            {size !== "all" ? (
              <span className="chip">Size: {size.toUpperCase()}</span>
            ) : null}
          </div>
          {(hasFocusedBrowse ||
            minPrice ||
            maxPrice ||
            color !== "all" ||
            size !== "all") && (
            <button
              type="button"
              className="button-secondary"
              onClick={clearBrowseFilters}
            >
              Clear browse filters
            </button>
          )}
        </div>

        {(department !== "all" || category !== "all") && (
          <div className="catalog-inline-filters">
            <label className="field">
              <span>Min price</span>
              <input
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="Min"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              <span>Max price</span>
              <input
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Max"
                inputMode="decimal"
              />
            </label>
            <label className="field">
              <span>Color</span>
              <select
                value={color}
                onChange={(event) => setColor(event.target.value)}
              >
                <option value="all">All colors</option>
                {availableColors.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatCatalogLabel(entry)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Size</span>
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                <option value="all">All sizes</option>
                {availableSizes.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {loading && <div className="message">Loading products...</div>}
        {searchLoading && <div className="message">Searching marketplace...</div>}
        {error && <div className="message error">{error}</div>}
        {!loading &&
          !searchLoading &&
          !error &&
          search.trim() &&
          visibleSearchSections.length > 0 && (
            <div className="catalog-search-order muted">
              Exact matches first, then broader related results:{" "}
              {searchSectionLabel}
            </div>
          )}
        {!loading &&
          !searchLoading &&
          !error &&
          showingFallbackProducts && (
            <div className="catalog-search-order muted">
              {searchResults?.noResultsMessage ??
                `No exact matches found for "${search.trim()}".`}{" "}
              Showing popular products instead.
            </div>
          )}
        {!loading && !searchLoading && !error && displayProducts.length === 0 && (
          <div className="empty">
            {searchResults?.noResultsMessage ??
              "No products match your current search."}
          </div>
        )}

        <div className="catalog-grid">
          {displayProducts.map((product) => (
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
                  <div className="product-price-row product-price-row-stacked">
                    <span className="price">
                      {formatCurrency(product.price)}
                    </span>
                  </div>
                  <div className="product-secondary-line">
                    {formatCatalogLabel(product.category)}
                    {product.color
                      ? ` · ${formatCatalogLabel(product.color)}`
                      : ""}
                    {product.size
                      ? ` · ${String(product.size).toUpperCase()}`
                      : ""}
                  </div>
                  <div
                    className={
                      product.stock > 0
                        ? "product-stock-line"
                        : "product-stock-line product-stock-line-empty"
                    }
                  >
                    {product.stock > 0
                      ? `${product.stock} available now`
                      : "Currently unavailable"}
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>

        <section className="vendors-strip-panel storefront-shops-section">
          <div className="vendors-strip-head">
            <div>
              <h2>Shops</h2>
              {(department !== "all" || category !== "all") && (
                <p className="muted">
                  {category !== "all"
                    ? `Shops matching ${formatCatalogLabel(category)}`
                    : `Shops matching ${formatCatalogLabel(department)}`}
                </p>
              )}
            </div>
            <Link
              className="table-link"
              href={`/shops${
                department !== "all" || category !== "all"
                  ? `?${new URLSearchParams({
                      ...(department !== "all" ? { department } : {}),
                      ...(category !== "all" ? { category } : {}),
                    }).toString()}`
                  : ""
              }`}
            >
              See all
            </Link>
          </div>
          {loading && <div className="message">Loading shops...</div>}
          {!loading && !error && featuredVendors.length === 0 && (
            <div className="empty">No public shops yet.</div>
          )}
          <div className="vendors-strip-grid">
            {featuredVendors.map((vendor) => (
              <Link
                key={vendor.id}
                href={`/shops/${vendor.id}`}
                className="vendor-public-card"
              >
                <div className="vendor-public-logo">
                  {vendor.logoUrl ? (
                    <img src={assetUrl(vendor.logoUrl)} alt={vendor.shopName} />
                  ) : (
                    <span>{vendor.shopName.slice(0, 1)}</span>
                  )}
                </div>
                <strong>{vendor.shopName}</strong>
                <span>{vendor.productCount} products</span>
              </Link>
            ))}
          </div>
        </section>
      </section>

      {quickViewProduct && (
        <div className="product-quick-view-overlay" onClick={closeQuickView}>
          <div
            className="product-quick-view-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="product-quick-view-close"
              onClick={closeQuickView}
            >
              Close
            </button>
            <div className="product-detail-card product-quick-view-card">
              <div className="product-detail-gallery">
                <div className="product-detail-main">
                  <ProductMedia
                    image={assetUrl(selectedQuickViewImage)}
                    title={quickViewProduct.title}
                    subtitle={`${formatCatalogLabel(quickViewProduct.department)} ${formatCatalogLabel(quickViewProduct.category)}`}
                  />
                </div>
                <div className="product-detail-thumbs">
                  {quickViewProduct.images.map((image) => (
                    <button
                      key={image}
                      type="button"
                      className={`thumb-button ${selectedQuickViewImage === image ? "active" : ""}`}
                      onClick={() => setSelectedQuickViewImage(image)}
                    >
                      <img src={assetUrl(image)} alt={quickViewProduct.title} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="product-detail-info">
                <div className="product-kicker">
                  {formatCatalogLabel(quickViewProduct.department)} /{" "}
                  {formatCatalogLabel(quickViewProduct.category)}
                </div>
                <h2 className="product-detail-title">
                  {quickViewProduct.title}
                </h2>
                <div className="product-detail-price">
                  {formatCurrency(quickViewProduct.price)}
                </div>
                <div className="product-stock detail-stock">
                  {quickViewProduct.stock > 0
                    ? `In stock: ${quickViewProduct.stock}`
                    : "Currently unavailable"}
                </div>
                <p className="product-detail-copy">
                  {quickViewProduct.description}
                </p>

                <div className="product-detail-actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() =>
                      addItem({
                        productId: quickViewProduct.id,
                        title: quickViewProduct.title,
                        price: quickViewProduct.price,
                        image: quickViewProduct.images[0],
                        quantity: 1,
                        stock: quickViewProduct.stock,
                      })
                    }
                    disabled={quickViewProduct.stock === 0}
                  >
                    {quickViewProduct.stock === 0 ? "Sold Out" : "Add to Cart"}
                  </button>
                  <Link
                    className="button-secondary"
                    href={`/products/${quickViewProduct.id}`}
                  >
                    Open full page
                  </Link>
                  <Link className="button-secondary" href="/cart">
                    Go to Cart
                  </Link>
                </div>

                <div className="product-detail-meta">
                  {quickViewProduct.vendor && (
                    <div className="meta-row">
                      <span>Shop</span>
                      <Link
                        className="table-link"
                        href={`/shops/${quickViewProduct.vendor.id}`}
                      >
                        {quickViewProduct.vendor.shopName}
                      </Link>
                    </div>
                  )}
                  <div className="meta-row">
                    <span>{getCatalogGenderLabel()}</span>
                    <strong>
                      {formatCatalogLabel(quickViewProduct.department)}
                    </strong>
                  </div>
                  <div className="meta-row">
                    <span>Category</span>
                    <strong>
                      {formatCatalogLabel(quickViewProduct.category)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
