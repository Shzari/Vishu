"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers";
import { FavoriteToggleButton } from "@/components/favorite-toggle-button";
import { ProductMedia } from "@/components/product-media";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import type { Product, PublicVendorDetail } from "@/lib/types";

export function ShopDetailClient() {
  const params = useParams<{ id: string }>();
  const { addItem } = useCart();
  const [shop, setShop] = useState<PublicVendorDetail | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShop() {
      try {
        const data = await apiRequest<PublicVendorDetail>(`/products/vendors/${params.id}`);
        setShop(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load shop.");
      } finally {
        setLoading(false);
      }
    }

    void loadShop();
  }, [params.id]);

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

  function openQuickView(product: Product) {
    setQuickViewProduct(product);
    setSelectedQuickViewImage(product.images[0]);
  }

  function closeQuickView() {
    setQuickViewProduct(null);
    setSelectedQuickViewImage(undefined);
  }

  const availableCategories = useMemo(
    () => ["all", ...(shop?.categories ?? [])],
    [shop?.categories],
  );
  const heroCategories = useMemo(
    () => (shop?.categories ?? []).slice(0, 4),
    [shop?.categories],
  );
  const infoRows = useMemo(
    () =>
      [
        shop?.shopDescription ? { label: "About", value: shop.shopDescription } : null,
        shop?.businessHours ? { label: "Hours", value: shop.businessHours } : null,
        shop?.supportEmail ? { label: "Support", value: shop.supportEmail } : null,
        shop?.supportPhone ? { label: "Phone", value: shop.supportPhone } : null,
        shop?.shippingNotes ? { label: "Shipping", value: shop.shippingNotes } : null,
        shop?.returnPolicy ? { label: "Returns", value: shop.returnPolicy } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
    [
      shop?.businessHours,
      shop?.returnPolicy,
      shop?.shippingNotes,
      shop?.shopDescription,
      shop?.supportEmail,
      shop?.supportPhone,
    ],
  );
  const visibleProducts = useMemo(() => {
    if (!shop) {
      return [];
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filtered = shop.products.filter((product) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${product.title} ${product.description} ${product.department} ${product.category} ${product.color ?? ""} ${product.size ?? ""}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "price-low") return left.price - right.price;
      if (sortBy === "price-high") return right.price - left.price;
      if (sortBy === "stock-high") return right.stock - left.stock;
      if (sortBy === "title") return left.title.localeCompare(right.title);
      if (sortBy === "newest") {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }
      if (right.stock !== left.stock) {
        return right.stock - left.stock;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [search, selectedCategory, shop, sortBy]);

  if (loading) {
    return <div className="message">Loading shop...</div>;
  }

  if (error || !shop) {
    return <div className="message error">{error ?? "Shop not found."}</div>;
  }

  return (
    <div className="shop-detail-page stack">
      <section className="shop-hero-panel">
        <div className="shop-hero-brand">
          <div className="shop-hero-logo">
            {shop.logoUrl ? (
              <img src={assetUrl(shop.logoUrl)} alt={shop.shopName} />
            ) : (
              <span>{shop.shopName.slice(0, 1)}</span>
            )}
          </div>
          <div className="shop-hero-copy">
            <div className="shop-hero-kicker-row">
              <div className="storefront-label">Vendor shop</div>
              <span className="shop-hero-pill">{shop.productCount} curated picks</span>
            </div>
            <h1 className="storefront-title">{shop.shopName}</h1>
            <p className="storefront-copy">
              {shop.shopDescription ||
                `${shop.shopName} brings together focused pieces with a cleaner storefront and a more direct shop identity.`}
            </p>
            {heroCategories.length > 0 ? (
              <div className="shop-hero-chips">
                {heroCategories.map((entry) => (
                  <span key={entry} className="chip">
                    {formatCatalogLabel(entry)}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="storefront-actions">
              <Link className="button" href="#shop-products">
                Browse products
              </Link>
              <Link className="storefront-secondary-action" href="/shops">
                Back to all shops
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="split shop-detail-layout">
        <aside className="stack shop-sidebar">
          {infoRows.length > 0 ? (
            <div className="shop-sidebar-info">
              <div className="shop-info-list">
                {infoRows.map((row) => (
                  <div key={row.label} className="shop-info-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="shop-sidebar-card">
            <h2>Categories</h2>
            <div className="chip-row shop-category-cloud">
              {shop.categories.map((entry) => (
                <span key={entry} className="chip">
                  {formatCatalogLabel(entry)}
                </span>
              ))}
            </div>
          </div>

        </aside>

        <div className="catalog-main shop-catalog-main" id="shop-products">
          <div className="catalog-toolbar shop-catalog-toolbar">
            <div>
              <h2>{shop.shopName} products</h2>
              <p>
                {visibleProducts.length} item{visibleProducts.length === 1 ? "" : "s"} available from this shop
              </p>
            </div>
            <div className="catalog-meta">
              <Link className="table-link" href="/shops">
                Back to all shops
              </Link>
            </div>
          </div>

          <div className="shop-filter-panel">
            <div className="shop-filter-bar">
              <label className="shop-filter-search">
                <span>Search this shop</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search inside ${shop.shopName}`}
                />
              </label>
              <label className="shop-filter-select">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="featured">Featured</option>
                  <option value="newest">Newest</option>
                  <option value="price-low">Price: low to high</option>
                  <option value="price-high">Price: high to low</option>
                  <option value="stock-high">Stock: high to low</option>
                  <option value="title">Title</option>
                </select>
              </label>
            </div>

            <div className="shop-filter-chips">
              {availableCategories.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  className={selectedCategory === entry ? "chip active" : "chip"}
                  onClick={() => setSelectedCategory(entry)}
                >
                  {entry === "all" ? "All categories" : formatCatalogLabel(entry)}
                </button>
              ))}
            </div>
          </div>

          {shop.products.length === 0 ? (
            <div className="empty">This shop has no public products yet.</div>
          ) : null}
          {shop.products.length > 0 && visibleProducts.length === 0 ? (
            <div className="empty">No products match this shop filter right now.</div>
          ) : null}

          <div className="catalog-grid shop-catalog-grid">
            {visibleProducts.map((product) => (
              <article key={product.id} className="product-card product-card-favoritable shop-product-card">
                <FavoriteToggleButton productId={product.id} />
                <button
                  type="button"
                  className="product-thumb product-thumb-button"
                  onClick={() => openQuickView(product)}
                >
                  <div className="product-media-shell">
                    <ProductMedia image={assetUrl(product.images[0])} title={product.title} />
                  </div>
                </button>
                <div className="product-card-body">
                  <div className="shop-product-kicker">
                    <span className="shop-product-category">{formatCatalogLabel(product.category)}</span>
                    <span
                      className={
                        product.stock > 0
                          ? "shop-product-availability"
                          : "shop-product-availability is-empty"
                      }
                    >
                      {product.stock > 0 ? "Ready now" : "Sold out"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="product-title-link product-title-button"
                    onClick={() => openQuickView(product)}
                  >
                    {product.title}
                  </button>
                  <div className="product-price-row product-price-row-stacked">
                    <span className="price">{formatCurrency(product.price)}</span>
                  </div>
                  <div className="product-subline">
                    {[
                      product.color ? formatCatalogLabel(product.color) : null,
                      product.size ? String(product.size).toUpperCase() : null,
                      getCatalogDepartmentDisplayLabel(product.department),
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                  <div
                    className={
                      product.stock > 0
                        ? "product-stock-line shop-stock-line"
                        : "product-stock-line product-stock-line-empty shop-stock-line"
                    }
                  >
                    {product.stock > 0 ? `${product.stock} available now` : "Currently unavailable"}
                  </div>
                  <div className="product-actions shop-product-actions">
                    <button
                      type="button"
                      className="button-ghost product-action-link"
                      onClick={() => openQuickView(product)}
                    >
                      Quick view
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
                          color: product.color ?? product.colors[0]?.name ?? null,
                          size:
                            product.size ??
                            product.sizeVariants[0]?.label ??
                            null,
                          quantity: 1,
                          stock: product.stock,
                        })
                      }
                      disabled={product.stock === 0}
                    >
                      {product.stock === 0 ? "Sold out" : "Add to cart"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {quickViewProduct ? (
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
                    subtitle={
                      getCatalogDepartmentDisplayLabel(quickViewProduct.department)
                        ? `${getCatalogDepartmentDisplayLabel(quickViewProduct.department)} ${formatCatalogLabel(quickViewProduct.category)}`
                        : formatCatalogLabel(quickViewProduct.category)
                    }
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
                  {getCatalogDepartmentDisplayLabel(quickViewProduct.department)
                    ? `${getCatalogDepartmentDisplayLabel(quickViewProduct.department)} / ${formatCatalogLabel(quickViewProduct.category)}`
                    : formatCatalogLabel(quickViewProduct.category)}
                </div>
                <h2 className="product-detail-title">{quickViewProduct.title}</h2>
                <div className="product-detail-price">{formatCurrency(quickViewProduct.price)}</div>
                <div className="product-stock detail-stock">
                  {quickViewProduct.stock > 0 ? `In stock: ${quickViewProduct.stock}` : "Currently unavailable"}
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
                        color:
                          quickViewProduct.color ??
                          quickViewProduct.colors[0]?.name ??
                          null,
                        size:
                          quickViewProduct.size ??
                          quickViewProduct.sizeVariants[0]?.label ??
                          null,
                        quantity: 1,
                        stock: quickViewProduct.stock,
                      })
                    }
                    disabled={quickViewProduct.stock === 0}
                  >
                    {quickViewProduct.stock === 0 ? "Sold out" : "Add to cart"}
                  </button>
                  <Link className="button-secondary" href={`/products/${quickViewProduct.id}`}>
                    Open full page
                  </Link>
                  <Link className="button-secondary" href="/cart">
                    Go to cart
                  </Link>
                </div>
                <div className="product-detail-meta">
                  {getCatalogDepartmentDisplayLabel(quickViewProduct.department) ? (
                    <div className="meta-row">
                      <span>{getCatalogGenderLabel()}</span>
                      <strong>{getCatalogDepartmentDisplayLabel(quickViewProduct.department)}</strong>
                    </div>
                  ) : null}
                  <div className="meta-row">
                    <span>Category</span>
                    <strong>{formatCatalogLabel(quickViewProduct.category)}</strong>
                  </div>
                  {quickViewProduct.color ? (
                    <div className="meta-row">
                      <span>Color</span>
                      <strong>{formatProductAttributeLabel(quickViewProduct.color)}</strong>
                    </div>
                  ) : null}
                  {quickViewProduct.size ? (
                    <div className="meta-row">
                      <span>Size</span>
                      <strong>{formatProductAttributeLabel(quickViewProduct.size)}</strong>
                    </div>
                  ) : null}
                  <div className="meta-row">
                    <span>Browse in marketplace</span>
                    <Link
                      className="table-link"
                      href={
                        getCatalogDepartmentDisplayLabel(quickViewProduct.department)
                          ? `/?department=${encodeURIComponent(quickViewProduct.department)}&category=${encodeURIComponent(quickViewProduct.category)}`
                          : `/?category=${encodeURIComponent(quickViewProduct.category)}`
                      }
                    >
                      More {formatCatalogLabel(quickViewProduct.category)}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
