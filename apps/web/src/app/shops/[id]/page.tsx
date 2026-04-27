"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { FavoriteStarButton } from "@/components/favorite-star-button";
import { ProductMedia } from "@/components/product-media";
import { RatingStars } from "@/components/rating-stars";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  filterCatalogCategories,
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import type { Product, PublicVendorDetail, ReviewStatus } from "@/lib/types";

export default function ShopDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, currentRole } = useAuth();
  const { addItem } = useCart();
  const [shop, setShop] = useState<PublicVendorDetail | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [selectedQuickViewImage, setSelectedQuickViewImage] = useState<string | undefined>();
  const [shopReviewStatus, setShopReviewStatus] = useState<ReviewStatus | null>(null);
  const [shopReviewRating, setShopReviewRating] = useState(5);
  const [shopReviewComment, setShopReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
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
    if (!token || currentRole !== "customer") {
      setShopReviewStatus(null);
      return;
    }

    let cancelled = false;

    apiRequest<ReviewStatus>(`/products/vendors/${params.id}/review-status`, undefined, token)
      .then((status) => {
        if (cancelled) {
          return;
        }

        setShopReviewStatus(status);
        setShopReviewRating(status.existingReview?.rating ?? 5);
        setShopReviewComment(status.existingReview?.comment ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setShopReviewStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, params.id, token]);

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

  async function refreshShop() {
    const data = await apiRequest<PublicVendorDetail>(`/products/vendors/${params.id}`);
    setShop(data);
  }

  async function submitShopReview() {
    if (!token) {
      return;
    }

    try {
      setReviewSaving(true);
      setReviewMessage(null);
      const response = await apiRequest<{ message: string; reviewStatus: ReviewStatus }>(
        `/products/vendors/${params.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            rating: shopReviewRating,
            comment: shopReviewComment.trim() || undefined,
          }),
        },
        token,
      );
      setShopReviewStatus(response.reviewStatus);
      setShopReviewRating(response.reviewStatus.existingReview?.rating ?? shopReviewRating);
      setShopReviewComment(response.reviewStatus.existingReview?.comment ?? "");
      setReviewMessage(response.message);
      await refreshShop();
    } catch (submitError) {
      setReviewMessage(submitError instanceof Error ? submitError.message : "Unable to save review.");
    } finally {
      setReviewSaving(false);
    }
  }

  const shopCategories = useMemo(
    () => filterCatalogCategories(shop?.categories ?? []),
    [shop?.categories],
  );
  const availableCategories = useMemo(() => ["all", ...shopCategories], [shopCategories]);

  useEffect(() => {
    if (selectedCategory !== "all" && !shopCategories.includes(selectedCategory)) {
      setSelectedCategory("all");
    }
  }, [selectedCategory, shopCategories]);

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
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;

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
              <Image src={assetUrl(shop.logoUrl)} alt={shop.shopName} width={138} height={138} unoptimized />
            ) : (
              <span>{shop.shopName.slice(0, 1)}</span>
            )}
          </div>
          <div className="shop-hero-copy">
            <h1 className="storefront-title">{shop.shopName}</h1>
            <RatingStars value={shop.ratingSummary.average} count={shop.ratingSummary.count} size="lg" />
            {shop.shopDescription ? <p className="storefront-copy">{shop.shopDescription}</p> : null}
            {shopCategories.length > 0 ? (
              <div className="shop-hero-chips">
                {shopCategories.slice(0, 4).map((entry) => (
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

      <section className="form-card stack review-panel">
        <div className="catalog-toolbar compact-toolbar">
          <div>
            <h2>Shop reviews</h2>
            <p>Customers can rate the shop after they receive a delivered order from it.</p>
          </div>
        </div>

        {currentRole === "customer" && shopReviewStatus?.canReview ? (
          <div className="review-composer">
            <div className="review-composer-head">
              <div>
                <strong>{shopReviewStatus.existingReview ? "Update your shop review" : "Rate this shop"}</strong>
                <p className="muted">
                  {shopReviewStatus.lastDeliveredAt
                    ? `Delivered on ${new Date(shopReviewStatus.lastDeliveredAt).toLocaleDateString()}`
                    : "Delivered purchases unlock shop reviews."}
                </p>
              </div>
              <RatingStars
                value={shopReviewRating}
                size="lg"
                interactive
                showValue={false}
                onChange={setShopReviewRating}
              />
            </div>
            <div className="field">
              <label>Review</label>
              <textarea
                rows={4}
                placeholder="Describe the overall shop experience, communication, packaging, or delivery reliability."
                value={shopReviewComment}
                onChange={(event) => setShopReviewComment(event.target.value)}
              />
            </div>
            <div className="inline-actions">
              <button type="button" className="button" disabled={reviewSaving} onClick={() => void submitShopReview()}>
                {reviewSaving ? "Saving..." : shopReviewStatus.existingReview ? "Update review" : "Publish review"}
              </button>
              {reviewMessage ? <span className="muted">{reviewMessage}</span> : null}
            </div>
          </div>
        ) : currentRole === "customer" ? (
          <div className="message">{shopReviewStatus?.reason ?? "Buy from this shop and receive the order to review it."}</div>
        ) : (
          <div className="message">Sign in as a customer to review shops after a delivered order.</div>
        )}

        {shop.recentReviews.length > 0 ? (
          <div className="review-list">
            {shop.recentReviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-card-head">
                  <div>
                    <strong>{review.customerName}</strong>
                    <p className="muted">{new Date(review.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <RatingStars value={review.rating} size="sm" showValue={false} />
                </div>
                <p>{review.comment || "Rated this shop without written feedback."}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No shop reviews yet.</div>
        )}
      </section>

      <section className="catalog-main shop-products-panel" id="shop-products">
        <div className="catalog-toolbar shop-products-head">
          <div>
            <h2>Products</h2>
            <p>Browse the current collection from {shop.shopName}.</p>
          </div>
          <div className="catalog-meta">
            <Link className="table-link" href="/shops">
              Back to all shops
            </Link>
          </div>
        </div>

        <div className="shop-products-toolbar">
          <div className="shop-filter-chips">
            {availableCategories.map((entry) => (
              <button
                key={entry}
                type="button"
                className={selectedCategory === entry ? "chip active" : "chip"}
                onClick={() => setSelectedCategory(entry)}
              >
                {entry === "all" ? "All products" : formatCatalogLabel(entry)}
              </button>
            ))}
          </div>
          <div className="shop-filter-bar">
            <label className="shop-filter-search">
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${shop.shopName}`}
              />
            </label>
            <label className="shop-filter-select">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
        </div>

        {shop.products.length === 0 ? <div className="empty">This shop has no public products yet.</div> : null}
        {shop.products.length > 0 && visibleProducts.length === 0 ? (
          <div className="empty">No products match this shop filter right now.</div>
        ) : null}

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
                <RatingStars
                  value={product.ratingSummary.average}
                  count={product.ratingSummary.count}
                  size="sm"
                  className="product-card-rating"
                />
                <div className="product-card-foot">
                  <span className="product-card-vendor">{shop.shopName}</span>
                  <span className="product-card-badge">{formatCatalogLabel(product.category)}</span>
                </div>
                <div className="product-price-row product-price-row-stacked">
                  <span className="price">{formatCurrency(product.price)}</span>
                </div>
                <div className="product-subline">
                  {formatCatalogLabel(product.category)}
                  {product.color ? ` · ${formatProductAttributeLabel(product.color)}` : ""}
                  {product.size ? ` · ${String(product.size).toUpperCase()}` : ""}
                </div>
                <div
                  className={
                    product.stock > 0 ? "product-stock-line" : "product-stock-line product-stock-line-empty"
                  }
                >
                  {product.stock > 0 ? "Available now" : "Currently unavailable"}
                </div>
                <div className="product-actions product-card-actions">
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
                        size: product.size ?? product.sizeVariants[0]?.label ?? null,
                        quantity: 1,
                        stock: product.stock,
                      })
                    }
                    disabled={product.stock === 0}
                  >
                    {product.stock === 0 ? "Sold out" : "Add to cart"}
                  </button>
                </div>
                <button type="button" className="product-inline-action" onClick={() => openQuickView(product)}>
                  Quick view
                </button>
              </div>
            </article>
          ))}
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
                        ? `${getCatalogDepartmentDisplayLabel(quickViewProduct.department)} ${formatCatalogLabel(
                            quickViewProduct.category,
                          )}`
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
                      <Image src={assetUrl(image)} alt={quickViewProduct.title} width={72} height={72} unoptimized />
                    </button>
                  ))}
                </div>
              </div>

              <div className="product-detail-info">
                <div className="product-kicker">
                  {getCatalogDepartmentDisplayLabel(quickViewProduct.department)
                    ? `${getCatalogDepartmentDisplayLabel(quickViewProduct.department)} / ${formatCatalogLabel(
                        quickViewProduct.category,
                      )}`
                    : formatCatalogLabel(quickViewProduct.category)}
                </div>
                <h2 className="product-detail-title">{quickViewProduct.title}</h2>
                <RatingStars
                  value={quickViewProduct.ratingSummary.average}
                  count={quickViewProduct.ratingSummary.count}
                  size="sm"
                />
                <div className="product-detail-price">{formatCurrency(quickViewProduct.price)}</div>
                <div className="product-stock detail-stock">
                  {quickViewProduct.stock > 0 ? "Available now" : "Currently unavailable"}
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
                        color: quickViewProduct.color ?? quickViewProduct.colors[0]?.name ?? null,
                        size: quickViewProduct.size ?? quickViewProduct.sizeVariants[0]?.label ?? null,
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
                          ? `/?department=${encodeURIComponent(
                              quickViewProduct.department,
                            )}&category=${encodeURIComponent(quickViewProduct.category)}`
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
