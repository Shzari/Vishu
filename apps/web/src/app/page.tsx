"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  PRODUCT_DEPARTMENTS,
  formatCatalogLabel,
  getCatalogCategoriesForDepartment,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import { ProductMedia } from "@/components/product-media";
import type { HomepageHeroConfig, Product, PublicVendorSummary } from "@/lib/types";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<PublicVendorSummary[]>([]);
  const [homepageHero, setHomepageHero] = useState<HomepageHeroConfig>({ intervalSeconds: 6, slides: [] });
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [category, setCategory] = useState("all");
  const [hoveredDepartment, setHoveredDepartment] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [color, setColor] = useState("all");
  const [size, setSize] = useState("all");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const { token, loading: authLoading } = useAuth();
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
        setError(loadError instanceof Error ? loadError.message : "Failed to load products.");
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
      window.history.replaceState({}, "", `/${nextQuery ? `?${nextQuery}` : ""}`);
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

  const categories = useMemo(
    () => ["all", ...getCatalogCategoriesForDepartment(department)],
    [department],
  );
  const categoryScopedProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesDepartment = department === "all" || product.department === department;
        const matchesCategory = category === "all" || product.category === category;

        return matchesDepartment && matchesCategory;
      }),
    [category, department, products],
  );
  const availableColors = useMemo(
    () =>
      [...new Set(categoryScopedProducts.map((product) => product.color).filter(Boolean))]
        .map((entry) => String(entry)),
    [categoryScopedProducts],
  );
  const availableSizes = useMemo(
    () =>
      [...new Set(categoryScopedProducts.map((product) => product.size).filter(Boolean))]
        .map((entry) => String(entry)),
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

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        search.trim().length === 0 ||
        `${product.title} ${product.description} ${product.department} ${product.category}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesDepartment = department === "all" || product.department === department;
      const matchesCategory = category === "all" || product.category === category;
      const matchesMinPrice = minPrice.trim().length === 0 || product.price >= Number(minPrice);
      const matchesMaxPrice = maxPrice.trim().length === 0 || product.price <= Number(maxPrice);
      const matchesColor = color === "all" || product.color === color;
      const matchesSize = size === "all" || product.size === size;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesCategory &&
        matchesMinPrice &&
        matchesMaxPrice &&
        matchesColor &&
        matchesSize
      );
    });
  }, [category, color, department, maxPrice, minPrice, products, search, size]);
  const hasFocusedBrowse = department !== "all" || category !== "all" || search.trim().length > 0;

  const inStockCount = filteredProducts.filter((product) => product.stock > 0).length;
  const featuredVendors = useMemo(() => {
    const relevantVendors = vendors.filter((vendor) => {
      const matchesDepartment =
        department === "all" || vendor.departments.includes(department);
      const matchesCategory =
        category === "all" || vendor.categories.includes(category);

      return matchesDepartment && matchesCategory;
    });
    const shuffled = [...(relevantVendors.length > 0 ? relevantVendors : vendors)];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled.slice(0, 8);
  }, [vendors]);
  const activeHeroSlide = homepageHero.slides[activeHeroIndex] ?? null;
  const storefrontDepartments = useMemo(
    () => PRODUCT_DEPARTMENTS.filter((entry) => entry !== "unisex"),
    [],
  );
  const topRailDepartment =
    hoveredDepartment ??
    (department !== "all" && storefrontDepartments.includes(department as "men" | "women")
      ? department
      : storefrontDepartments[0]);
  const topRailCategories = useMemo(
    () => getCatalogCategoriesForDepartment(topRailDepartment),
    [topRailDepartment],
  );
  const highlightedBrowseDepartment =
    department !== "all" && storefrontDepartments.includes(department as "men" | "women")
      ? department
      : topRailDepartment;
  const categoryHighlights = useMemo(() => {
    const counts = new Map<string, number>();

    products.forEach((product) => {
      if (product.department !== highlightedBrowseDepartment) {
        return;
      }

      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 6);
  }, [highlightedBrowseDepartment, products]);

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
    setActiveHeroIndex(0);
  }, [homepageHero.slides.length]);

  useEffect(() => {
    if (homepageHero.slides.length <= 1) {
      return;
    }

    const intervalMs = Math.max(homepageHero.intervalSeconds, 3) * 1000;
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % homepageHero.slides.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [homepageHero.intervalSeconds, homepageHero.slides.length]);

  function openQuickView(product: Product) {
    setQuickViewProduct(product);
    setSelectedQuickViewImage(product.images[0]);
  }

  function closeQuickView() {
    setQuickViewProduct(null);
    setSelectedQuickViewImage(undefined);
  }

  function showPreviousHeroSlide() {
    if (!homepageHero.slides.length) {
      return;
    }

    setActiveHeroIndex((current) =>
      current === 0 ? homepageHero.slides.length - 1 : current - 1,
    );
  }

  function showNextHeroSlide() {
    if (!homepageHero.slides.length) {
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
        <aside className="storefront-category-rail" onMouseLeave={() => setHoveredDepartment(null)}>
          <div className="storefront-category-rail-head">
            <div className="storefront-label">Categories</div>
          </div>
          <div className="storefront-department-tabs">
            {storefrontDepartments.map((entry) => (
              <button
                key={entry}
                type="button"
                className={topRailDepartment === entry ? "button" : "button-secondary"}
                onMouseEnter={() => setHoveredDepartment(entry)}
                onFocus={() => setHoveredDepartment(entry)}
                onClick={() => {
                  setHoveredDepartment(entry);
                  setDepartment(entry);
                  setCategory("all");
                }}
              >
                {formatCatalogLabel(entry)}
              </button>
            ))}
          </div>
          <div className="storefront-category-list">
            <button
              type="button"
              className={department === topRailDepartment && category === "all" ? "storefront-category-link active" : "storefront-category-link"}
              onClick={() => {
                setDepartment(topRailDepartment);
                setCategory("all");
              }}
            >
              <span>All {formatCatalogLabel(topRailDepartment)}</span>
              <strong>›</strong>
            </button>
            {topRailCategories.map((entry) => (
              <button
                key={entry}
                type="button"
                className={department === topRailDepartment && category === entry ? "storefront-category-link active" : "storefront-category-link"}
                onClick={() => {
                  setDepartment(topRailDepartment);
                  setCategory(entry);
                }}
              >
                <span>{formatCatalogLabel(entry)}</span>
                <strong>›</strong>
              </button>
            ))}
          </div>
          <Link className="button-secondary storefront-category-jump" href="#posted-products">
            Go to posted products
          </Link>
        </aside>

      {activeHeroSlide ? (
        <section className="hero-carousel-panel hero-carousel-panel-top">
          <button
            type="button"
            className="hero-carousel-arrow hero-carousel-arrow-left"
            onClick={showPreviousHeroSlide}
            aria-label="Previous featured product"
          >
            ‹
          </button>
          <div className="hero-carousel-card">
            <div className="hero-carousel-copy">
              <div className="storefront-label">Featured product board</div>
              <h1 className="storefront-title">
                {activeHeroSlide.headline || activeHeroSlide.product.title}
              </h1>
              <p className="storefront-copy">
                {activeHeroSlide.subheading || activeHeroSlide.product.description}
              </p>
              <div className="hero-carousel-meta">
                <span className="chip">{formatCatalogLabel(activeHeroSlide.product.category)}</span>
                <span className="chip">{formatCatalogLabel(activeHeroSlide.product.department)}</span>
                <strong>{formatCurrency(activeHeroSlide.product.price)}</strong>
              </div>
              <div className="storefront-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => openQuickView(activeHeroSlide.product)}
                >
                  {activeHeroSlide.ctaLabel || "View product"}
                </button>
                <Link className="button-secondary" href="#posted-products">
                  View posted products
                </Link>
              </div>
            </div>
            <button
              type="button"
              className="hero-carousel-media"
              onClick={() => openQuickView(activeHeroSlide.product)}
            >
              <ProductMedia
                image={assetUrl(activeHeroSlide.product.images[0])}
                title={activeHeroSlide.product.title}
              />
            </button>
          </div>
          <button
            type="button"
            className="hero-carousel-arrow hero-carousel-arrow-right"
            onClick={showNextHeroSlide}
            aria-label="Next featured product"
          >
            ›
          </button>
          <div className="hero-carousel-dots">
            {homepageHero.slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === activeHeroIndex ? "hero-carousel-dot active" : "hero-carousel-dot"}
                onClick={() => setActiveHeroIndex(index)}
                aria-label={`Show featured product ${index + 1}`}
              />
            ))}
          </div>
        </section>
      ) : !authLoading && !token ? (
        <section className="storefront-banner">
          <div>
            <div className="storefront-label">Everyday fashion marketplace</div>
            <h1 className="storefront-title">Shop by gender, category, or favorite store.</h1>
          </div>
          <div className="storefront-actions">
            <Link className="button" href="/register">
              Create account
            </Link>
            <Link className="button-secondary" href="/shops">
              Browse shops
            </Link>
          </div>
        </section>
      ) : null
      }
      </section>

      {categoryHighlights.length > 0 && (
        <section className="catalog-shortcuts-panel">
          <div className="catalog-toolbar compact-toolbar">
            <div>
              <h2>Popular in {formatCatalogLabel(highlightedBrowseDepartment)}</h2>
              <p>Start with the categories customers are most likely to browse first.</p>
            </div>
            <div className="catalog-meta">
              <button
                type="button"
                className="table-link button-reset"
                onClick={() => {
                  setDepartment(highlightedBrowseDepartment);
                  setCategory("all");
                }}
              >
                View all {formatCatalogLabel(highlightedBrowseDepartment)}
              </button>
            </div>
          </div>

          <div className="catalog-shortcuts-grid">
            {categoryHighlights.map(([entry, count]) => (
              <button
                key={entry}
                type="button"
                className={
                  department === highlightedBrowseDepartment && category === entry
                    ? "catalog-shortcut-card active"
                    : "catalog-shortcut-card"
                }
                onClick={() => {
                  setDepartment(highlightedBrowseDepartment);
                  setCategory(entry);
                }}
              >
                <strong>{formatCatalogLabel(entry)}</strong>
                <span>{count} products</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="posted-products" className="catalog-main">
          <div className="catalog-toolbar compact-toolbar">
            <div>
              <h2>Posted products</h2>
              <p>{filteredProducts.length} products in the current browse view</p>
            </div>
            <div className="catalog-meta">
              <Link className="table-link" href="/shops">
                Browse shops
              </Link>
            </div>
          </div>

          <div className="catalog-browse-summary">
            <div className="chip-row">
              {search.trim() ? <span className="chip">Search: {search.trim()}</span> : null}
              {department !== "all" ? (
                <span className="chip">{formatCatalogLabel(department)}</span>
              ) : null}
              {category !== "all" ? (
                <span className="chip">{formatCatalogLabel(category)}</span>
              ) : null}
              {color !== "all" ? <span className="chip">Color: {formatCatalogLabel(color)}</span> : null}
              {size !== "all" ? <span className="chip">Size: {size.toUpperCase()}</span> : null}
            </div>
            {(hasFocusedBrowse || minPrice || maxPrice || color !== "all" || size !== "all") && (
              <button type="button" className="button-secondary" onClick={clearBrowseFilters}>
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
                <select value={color} onChange={(event) => setColor(event.target.value)}>
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
                <select value={size} onChange={(event) => setSize(event.target.value)}>
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
          {error && <div className="message error">{error}</div>}
          {!loading && !error && filteredProducts.length === 0 && (
            <div className="empty">No products match your current search.</div>
          )}

          <div className="catalog-grid">
            {filteredProducts.map((product) => (
              <article key={product.id} className="product-card">
                <button
                  type="button"
                  className="product-thumb product-thumb-button"
                  onClick={() => openQuickView(product)}
                >
                  <ProductMedia image={assetUrl(product.images[0])} title={product.title} />
                </button>
                <div className="product-card-body">
                  <div className="product-head-row">
                    <div>
                      <div className="product-kicker">
                        {formatCatalogLabel(product.department)} / {formatCatalogLabel(product.category)}
                      </div>
                      <button
                        type="button"
                        className="product-title-link product-title-button"
                        onClick={() => openQuickView(product)}
                      >
                        {product.title}
                      </button>
                    </div>
                    <div className="product-price-row">
                      <span className="price">{formatCurrency(product.price)}</span>
                    </div>
                  </div>
                  <p className="product-summary">
                    {product.description.slice(0, 82)}
                    {product.description.length > 82 ? "..." : ""}
                  </p>
                  {product.vendor && (
                    <Link className="product-vendor-link" href={`/shops/${product.vendor.id}`}>
                      {product.vendor.shopName}
                    </Link>
                  )}
                  <div className="product-actions">
                    <button
                      type="button"
                      className="button-ghost product-action-link"
                      onClick={() => openQuickView(product)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="button product-action-button"
                      onClick={() =>
                        addItem({
                          productId: product.id,
                          title: product.title,
                          price: product.price,
                          image: product.images[0],
                          quantity: 1,
                          stock: product.stock,
                        })
                      }
                      disabled={product.stock === 0}
                    >
                      {product.stock === 0 ? "Sold Out" : "Add to Cart"}
                    </button>
                  </div>
                </div>
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
            {!loading && !error && featuredVendors.length === 0 && <div className="empty">No public shops yet.</div>}
            <div className="vendors-strip-grid">
              {featuredVendors.map((vendor) => (
                <Link key={vendor.id} href={`/shops/${vendor.id}`} className="vendor-public-card">
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
          <div className="product-quick-view-shell" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="product-quick-view-close" onClick={closeQuickView}>
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
                  {formatCatalogLabel(quickViewProduct.department)} / {formatCatalogLabel(quickViewProduct.category)}
                </div>
                <h2 className="product-detail-title">{quickViewProduct.title}</h2>
                <div className="product-detail-price">{formatCurrency(quickViewProduct.price)}</div>
                <div className="product-stock detail-stock">
                  {quickViewProduct.stock > 0
                    ? `In stock: ${quickViewProduct.stock}`
                    : "Currently unavailable"}
                </div>
                <p className="product-detail-copy">{quickViewProduct.description}</p>

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
                  <Link className="button-secondary" href={`/products/${quickViewProduct.id}`}>
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
                      <Link className="table-link" href={`/shops/${quickViewProduct.vendor.id}`}>
                        {quickViewProduct.vendor.shopName}
                      </Link>
                    </div>
                  )}
                  <div className="meta-row">
                    <span>{getCatalogGenderLabel()}</span>
                    <strong>{formatCatalogLabel(quickViewProduct.department)}</strong>
                  </div>
                  <div className="meta-row">
                    <span>Category</span>
                    <strong>{formatCatalogLabel(quickViewProduct.category)}</strong>
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
