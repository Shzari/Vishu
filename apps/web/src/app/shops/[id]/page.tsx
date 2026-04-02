"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers";
import { FavoriteStarButton } from "@/components/favorite-star-button";
import { ProductMedia } from "@/components/product-media";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import type { Product, PublicVendorDetail } from "@/lib/types";

export default function ShopDetailPage() {
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

  const inStockCount = useMemo(
    () => shop?.products.filter((product) => product.stock > 0).length ?? 0,
    [shop],
  );
  const availableCategories = useMemo(
    () => ["all", ...(shop?.categories ?? [])],
    [shop?.categories],
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
    <div className="stack">
      <section className="shop-hero-panel">
        <div className="shop-hero-brand">
          <div className="shop-hero-logo">
            {shop.logoUrl ? <img src={assetUrl(shop.logoUrl)} alt={shop.shopName} /> : <span>{shop.shopName.slice(0, 1)}</span>}
          </div>
          <div>
            <div className="storefront-label">Vendor shop</div>
            <h1 className="storefront-title">{shop.shopName}</h1>
            {shop.shopDescription && <p className="storefront-copy">{shop.shopDescription}</p>}
            <div className="storefront-actions">
              <Link className="button" href="#shop-products">
                Browse this shop
              </Link>
              <Link className="storefront-secondary-action" href="/shops">
                Back to all shops
              </Link>
            </div>
          </div>
        </div>
        <div className="shop-hero-stats">
          <div className="mini-stat">
            <strong>{shop.productCount}</strong>
            <span className="muted">Products</span>
          </div>
          <div className="mini-stat">
            <strong>{shop.categories.length}</strong>
            <span className="muted">Categories</span>
          </div>
          <div className="mini-stat">
            <strong>{inStockCount}</strong>
            <span className="muted">In stock</span>
          </div>
        </div>
      </section>

      <section className="split shop-detail-layout">
        <aside className="stack">
          <div className="sidebar-card">
            <h2>Shop information</h2>
            {shop.businessHours && <p className="muted">Hours: {shop.businessHours}</p>}
            {shop.supportEmail && <p className="muted">Support: {shop.supportEmail}</p>}
            {shop.supportPhone && <p className="muted">Phone: {shop.supportPhone}</p>}
            {shop.shippingNotes && <p className="muted">Shipping: {shop.shippingNotes}</p>}
          </div>
          {shop.returnPolicy && (
            <div className="sidebar-card">
              <h2>Return policy</h2>
              <p className="muted">{shop.returnPolicy}</p>
            </div>
          )}
          <div className="sidebar-card">
              <h2>Categories</h2>
              <div className="chip-row">
                {shop.categories.map((entry) => (
                <span key={entry} className="chip">{formatCatalogLabel(entry)}</span>
                ))}
              </div>
            </div>
        </aside>

        <div className="catalog-main" id="shop-products">
          <div className="catalog-toolbar">
            <div>
              <h2>{shop.shopName} products</h2>
              <p>{visibleProducts.length} items available from this shop</p>
            </div>
            <div className="catalog-meta">
              <Link className="table-link" href="/shops">
                Back to all shops
              </Link>
            </div>
          </div>

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

          {shop.products.length === 0 && <div className="empty">This shop has no public products yet.</div>}
          {shop.products.length > 0 && visibleProducts.length === 0 && (
            <div className="empty">No products match this shop filter right now.</div>
          )}

          <div className="catalog-grid">
            {visibleProducts.map((product) => (
              <article key={product.id} className="product-card">
                <FavoriteStarButton product={product} className="product-card-favorite" />
                <Link href={`/products/${product.id}`} className="product-thumb">
                  <div className="product-media-shell">
                    <ProductMedia image={assetUrl(product.images[0])} title={product.title} />
                  </div>
                </Link>
                <div className="product-card-body">
                  <Link href={`/products/${product.id}`} className="product-title-link">
                    {product.title}
                  </Link>
                  <div className="product-card-foot">
                    <span className="product-card-vendor">{shop.shopName}</span>
                    <span className="product-card-badge">{formatCatalogLabel(product.category)}</span>
                  </div>
                  <div className="product-price-row product-price-row-stacked">
                    <span className="price">{formatCurrency(product.price)}</span>
                  </div>
                  <div className="product-subline">
                    {formatCatalogLabel(product.category)}
                    {product.color ? ` · ${formatCatalogLabel(product.color)}` : ""}
                    {product.size ? ` · ${String(product.size).toUpperCase()}` : ""}
                  </div>
                  <div
                    className={
                      product.stock > 0 ? "product-stock-line" : "product-stock-line product-stock-line-empty"
                    }
                  >
                    {product.stock > 0 ? `${product.stock} available now` : "Currently unavailable"}
                  </div>
                  <div className="product-actions product-card-actions">
                    <Link href={`/products/${product.id}`} className="button-ghost product-action-link">
                      Open product
                    </Link>
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
                  <button
                    type="button"
                    className="product-inline-action"
                    onClick={() => openQuickView(product)}
                  >
                    Quick view
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
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
                    subtitle={
                      getCatalogDepartmentDisplayLabel(
                        quickViewProduct.department,
                      )
                        ? `${getCatalogDepartmentDisplayLabel(
                            quickViewProduct.department,
                          )} ${formatCatalogLabel(quickViewProduct.category)}`
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
                  {getCatalogDepartmentDisplayLabel(
                    quickViewProduct.department,
                  )
                    ? `${getCatalogDepartmentDisplayLabel(
                        quickViewProduct.department,
                      )} / ${formatCatalogLabel(quickViewProduct.category)}`
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
                  {getCatalogDepartmentDisplayLabel(
                    quickViewProduct.department,
                  ) ? (
                    <div className="meta-row">
                      <span>{getCatalogGenderLabel()}</span>
                      <strong>
                        {getCatalogDepartmentDisplayLabel(
                          quickViewProduct.department,
                        )}
                      </strong>
                    </div>
                  ) : null}
                  <div className="meta-row">
                    <span>Category</span>
                    <strong>{formatCatalogLabel(quickViewProduct.category)}</strong>
                  </div>
                  {quickViewProduct.color && (
                    <div className="meta-row">
                      <span>Color</span>
                      <strong>{formatProductAttributeLabel(quickViewProduct.color)}</strong>
                    </div>
                  )}
                  {quickViewProduct.size && (
                    <div className="meta-row">
                      <span>Size</span>
                      <strong>{formatProductAttributeLabel(quickViewProduct.size)}</strong>
                    </div>
                  )}
                  <div className="meta-row">
                    <span>Browse in marketplace</span>
                    <Link
                      className="table-link"
                      href={
                        getCatalogDepartmentDisplayLabel(
                          quickViewProduct.department,
                        )
                          ? `/?department=${encodeURIComponent(
                              quickViewProduct.department,
                            )}&category=${encodeURIComponent(
                              quickViewProduct.category,
                            )}`
                          : `/?category=${encodeURIComponent(
                              quickViewProduct.category,
                            )}`
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
      )}
    </div>
  );
}
