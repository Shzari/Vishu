"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth, useCart } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  isCatalogDepartmentVisible,
} from "@/lib/catalog";
import { FavoriteStarButton } from "@/components/favorite-star-button";
import { ProductMedia } from "@/components/product-media";
import { RatingStars } from "@/components/rating-stars";
import type { Product, ReviewStatus } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, currentRole } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [shopReviewStatus, setShopReviewStatus] = useState<ReviewStatus | null>(null);
  const [shopReviewRating, setShopReviewRating] = useState(5);
  const [shopReviewComment, setShopReviewComment] = useState("");
  const [shopReviewSaving, setShopReviewSaving] = useState(false);
  const [shopReviewMessage, setShopReviewMessage] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<"product" | "shop" | null>(null);

  useEffect(() => {
    async function loadProduct() {
      try {
        const [data, catalog] = await Promise.all([
          apiRequest<Product>(`/products/${params.id}`),
          apiRequest<Product[]>("/products"),
        ]);
        setProduct(data);
        setSelectedImage(data.images[0]);
        setRelatedProducts(
          catalog
            .filter((entry) => entry.id !== data.id)
            .sort((left, right) => {
              const leftScore =
                (left.category === data.category ? 2 : 0) +
                (left.department === data.department ? 1 : 0);
              const rightScore =
                (right.category === data.category ? 2 : 0) +
                (right.department === data.department ? 1 : 0);

              if (rightScore !== leftScore) {
                return rightScore - leftScore;
              }

              return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
            })
            .slice(0, 4),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load product.");
      }
    }

    void loadProduct();
  }, [params.id]);

  useEffect(() => {
    if (!token || currentRole !== "customer") {
      setReviewStatus(null);
      return;
    }

    let cancelled = false;

    apiRequest<ReviewStatus>(`/products/${params.id}/review-status`, undefined, token)
      .then((status) => {
        if (cancelled) {
          return;
        }

        setReviewStatus(status);
        setReviewRating(status.existingReview?.rating ?? 5);
        setReviewComment(status.existingReview?.comment ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setReviewStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole, params.id, token]);

  useEffect(() => {
    if (!token || currentRole !== "customer" || !product?.vendor) {
      setShopReviewStatus(null);
      return;
    }

    let cancelled = false;

    apiRequest<ReviewStatus>(`/products/vendors/${product.vendor.id}/review-status`, undefined, token)
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
  }, [currentRole, product?.vendor, token]);

  useEffect(() => {
    if (!reviewModal || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReviewModal(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [reviewModal]);

  async function refreshProduct() {
    const data = await apiRequest<Product>(`/products/${params.id}`);
    setProduct(data);
    setSelectedImage((current) => current ?? data.images[0]);
  }

  async function submitReview() {
    if (!token) {
      return;
    }

    try {
      setReviewSaving(true);
      setReviewMessage(null);

      const response = await apiRequest<{ message: string; reviewStatus: ReviewStatus }>(
        `/products/${params.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            rating: reviewRating,
            comment: reviewComment.trim() || undefined,
          }),
        },
        token,
      );

      setReviewStatus(response.reviewStatus);
      setReviewRating(response.reviewStatus.existingReview?.rating ?? reviewRating);
      setReviewComment(response.reviewStatus.existingReview?.comment ?? "");
      setReviewMessage(response.message);
      await refreshProduct();
    } catch (submitError) {
      setReviewMessage(submitError instanceof Error ? submitError.message : "Unable to save review.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function submitShopReview() {
    if (!token || !product?.vendor) {
      return;
    }

    try {
      setShopReviewSaving(true);
      setShopReviewMessage(null);

      const response = await apiRequest<{ message: string; reviewStatus: ReviewStatus }>(
        `/products/vendors/${product.vendor.id}/reviews`,
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
      setShopReviewMessage(response.message);
      await refreshProduct();
    } catch (submitError) {
      setShopReviewMessage(submitError instanceof Error ? submitError.message : "Unable to save shop review.");
    } finally {
      setShopReviewSaving(false);
    }
  }

  function openReviewModal(target: "product" | "shop") {
    if (target === "shop" && !product?.vendor) {
      return;
    }

    setReviewModal(target);
  }

  if (error) {
    return <div className="message error">{error}</div>;
  }

  if (!product) {
    return <div className="message">Loading product...</div>;
  }

  const departmentLabel = getCatalogDepartmentDisplayLabel(product.department);
  const categoryBrowseHref = isCatalogDepartmentVisible(product.department)
    ? `/?department=${encodeURIComponent(product.department)}&category=${encodeURIComponent(
        product.category,
      )}`
    : `/?category=${encodeURIComponent(product.category)}`;
  const departmentBrowseHref = isCatalogDepartmentVisible(product.department)
    ? `/?department=${encodeURIComponent(product.department)}`
    : null;
  const productReviewSupportText =
    currentRole !== "customer"
      ? "Sign in as a customer to review this product."
      : reviewStatus?.canReview
        ? reviewStatus.lastDeliveredAt
          ? `Delivered on ${new Date(reviewStatus.lastDeliveredAt).toLocaleDateString()}`
          : "Your delivered purchase unlocked reviews for this product."
        : reviewStatus?.reason ?? "Buy and receive this product to leave a review.";
  const shopReviewSupportText =
    currentRole !== "customer"
      ? "Sign in as a customer to review this shop."
      : shopReviewStatus?.canReview
        ? shopReviewStatus.lastDeliveredAt
          ? `Delivered on ${new Date(shopReviewStatus.lastDeliveredAt).toLocaleDateString()}`
          : "Your delivered purchase unlocked shop reviews."
        : shopReviewStatus?.reason ?? "Buy from this shop and receive the order to leave a review.";
  const isShopReviewModal = reviewModal === "shop";
  const activeReviewStatus = isShopReviewModal ? shopReviewStatus : reviewStatus;
  const activeReviewMessage = isShopReviewModal ? shopReviewMessage : reviewMessage;
  const activeReviewSaving = isShopReviewModal ? shopReviewSaving : reviewSaving;
  const activeReviewHeading = isShopReviewModal ? `Review ${product.vendor?.shopName ?? "shop"}` : "Review this product";
  const activeReviewCopy = isShopReviewModal
    ? "Share your shop experience, packaging, communication, and delivery confidence."
    : "Share your thoughts on quality, fit, delivery, and anything helpful for the next customer.";
  const activeReviewPlaceholder = isShopReviewModal
    ? "Describe the overall shop experience, communication, packaging, or delivery reliability."
    : "Talk about quality, fit, delivery, or anything helpful for the next customer.";
  const activeReviewLockedText = isShopReviewModal ? shopReviewSupportText : productReviewSupportText;

  return (
    <div className="product-detail-shell stack">
      <div className="product-detail-top-links">
        <Link className="table-link" href={categoryBrowseHref}>
          Back to {formatCatalogLabel(product.category)}
        </Link>
        {product.vendor ? (
          <Link className="table-link" href={`/shops/${product.vendor.id}`}>
            Visit {product.vendor.shopName}
          </Link>
        ) : (
          <Link className="table-link" href="/shops">
            Browse shops
          </Link>
        )}
      </div>

      <div className="product-detail-card">
        <div className="product-detail-gallery">
          <div className="product-detail-main">
            <ProductMedia
              image={assetUrl(selectedImage)}
              title={product.title}
              subtitle={
                departmentLabel
                  ? `${departmentLabel} ${formatCatalogLabel(product.category)}`
                  : formatCatalogLabel(product.category)
              }
            />
          </div>
          <div className="product-detail-thumbs">
            {product.images.map((image) => (
              <button
                key={image}
                type="button"
                className={`thumb-button ${selectedImage === image ? "active" : ""}`}
                onClick={() => setSelectedImage(image)}
              >
                <img src={assetUrl(image)} alt={product.title} />
              </button>
            ))}
          </div>
        </div>

        <div className="product-detail-info">
          <div className="product-kicker">
            {departmentLabel
              ? `${departmentLabel} / ${formatCatalogLabel(product.category)}`
              : formatCatalogLabel(product.category)}
          </div>
          <h1 className="product-detail-title">{product.title}</h1>
          <RatingStars value={product.ratingSummary.average} count={product.ratingSummary.count} size="lg" />
          {product.vendor ? (
            <div className="product-detail-shop-link">
              <span>Sold by</span>
              <Link className="table-link" href={`/shops/${product.vendor.id}`}>
                {product.vendor.shopName}
              </Link>
            </div>
          ) : null}
          <div className="product-detail-price">{formatCurrency(product.price)}</div>
          <div className="product-stock detail-stock">
            {product.stock > 0 ? `In stock: ${product.stock}` : "Currently unavailable"}
          </div>
          <p className="product-detail-copy">{product.description}</p>

          <div className="mini-stats product-detail-mini-stats">
            <div className="mini-stat">
              <span>Availability</span>
              <strong>{product.stock > 0 ? "Ready" : "Paused"}</strong>
            </div>
            <div className="mini-stat">
              <span>Category</span>
              <strong>{formatCatalogLabel(product.category)}</strong>
            </div>
            <div className="mini-stat">
              <span>Shop</span>
              <strong>{product.vendor?.shopName ?? "Marketplace"}</strong>
            </div>
          </div>

          <div className="product-detail-actions">
            <button
              type="button"
              className="button"
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
              {product.stock === 0 ? "Sold Out" : "Add to Cart"}
            </button>
            {product.vendor ? (
              <Link className="button-secondary" href={`/shops/${product.vendor.id}`}>
                Visit shop
              </Link>
            ) : null}
            <Link className="button-secondary" href="/cart">
              Go to Cart
            </Link>
          </div>

          <div className="product-detail-browse-row">
            {departmentBrowseHref ? (
              <Link className="chip" href={departmentBrowseHref}>
                {departmentLabel}
              </Link>
            ) : null}
            <Link className="chip" href={categoryBrowseHref}>
              {formatCatalogLabel(product.category)}
            </Link>
          </div>

          <div className="product-detail-meta">
            {departmentLabel ? (
              <div className="meta-row">
                <span>Gender</span>
                <strong>{departmentLabel === "Men" ? "Male" : "Female"}</strong>
              </div>
            ) : null}
            <div className="meta-row">
              <span>Category</span>
              <strong>{formatCatalogLabel(product.category)}</strong>
            </div>
            {product.vendor ? (
              <div className="meta-row">
                <span>Shop</span>
                <Link className="table-link" href={`/shops/${product.vendor.id}`}>
                  {product.vendor.shopName}
                </Link>
              </div>
            ) : null}
            {product.color ? (
              <div className="meta-row">
                <span>Color</span>
                <strong>{formatProductAttributeLabel(product.color)}</strong>
              </div>
            ) : null}
            {product.size ? (
              <div className="meta-row">
                <span>Size</span>
                <strong>{formatProductAttributeLabel(product.size)}</strong>
              </div>
            ) : null}
            <div className="meta-row">
              <span>Storefront</span>
              <strong>Marketplace listing with shop context</strong>
            </div>
          </div>
        </div>
      </div>

      <section className="form-card stack review-panel">
        <div className="catalog-toolbar compact-toolbar review-panel-head">
          <div>
            <h2>Customer reviews</h2>
            <p>Verified buyers can rate this product after their order is delivered.</p>
          </div>
          <div className="review-panel-actions">
            <button type="button" className="button-ghost" onClick={() => openReviewModal("product")}>
              Review product
            </button>
            {product.vendor ? (
              <button type="button" className="button-ghost" onClick={() => openReviewModal("shop")}>
                Review shop
              </button>
            ) : null}
          </div>
        </div>

        <div className="review-panel-note">
          <strong>{reviewStatus?.existingReview ? "Your product review is ready to update." : "Open the review pop-up when you are ready."}</strong>
          <p>{productReviewSupportText}</p>
        </div>

        {product.recentReviews && product.recentReviews.length > 0 ? (
          <div className="review-list">
            {product.recentReviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-card-head">
                  <div>
                    <strong>{review.customerName}</strong>
                    <p className="muted">{new Date(review.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <RatingStars value={review.rating} size="sm" showValue={false} />
                </div>
                <p>{review.comment || "Rated this product without written feedback."}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No product reviews yet.</div>
        )}
      </section>

      {relatedProducts.length > 0 ? (
        <section className="sidebar-card related-products-panel">
          <div className="catalog-toolbar compact-toolbar">
            <div>
              <h2>Keep browsing</h2>
              <p>More products in a similar part of the catalog</p>
            </div>
          </div>
          <div className="catalog-grid related-products-grid">
            {relatedProducts.map((entry) => (
              <article key={entry.id} className="product-card compact-product-card">
                <FavoriteStarButton product={entry} className="product-card-favorite" />
                <Link href={`/products/${entry.id}`} className="product-thumb">
                  <div className="product-media-shell">
                    <ProductMedia image={assetUrl(entry.images[0])} title={entry.title} />
                  </div>
                </Link>
                <div className="product-card-body">
                  <div className="product-head-row">
                    <div>
                      <div className="product-kicker">{formatCatalogLabel(entry.category)}</div>
                      <Link href={`/products/${entry.id}`} className="product-title-link">
                        {entry.title}
                      </Link>
                    </div>
                    <div className="product-price-row">
                      <span className="price">{formatCurrency(entry.price)}</span>
                    </div>
                  </div>
                  <RatingStars
                    value={entry.ratingSummary.average}
                    count={entry.ratingSummary.count}
                    size="sm"
                    className="product-card-rating"
                  />
                  <div className="product-secondary-line">
                    {[
                      getCatalogDepartmentDisplayLabel(entry.department),
                      entry.color ? formatProductAttributeLabel(entry.color) : null,
                      entry.size ? formatProductAttributeLabel(entry.size) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {reviewModal ? (
        <div className="review-modal-backdrop" role="presentation" onClick={() => setReviewModal(null)}>
          <div
            className="review-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-review-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="review-modal-head">
              <div>
                <h2 id="product-review-modal-title">{activeReviewHeading}</h2>
                <p>{activeReviewCopy}</p>
              </div>
              <button type="button" className="button-ghost" onClick={() => setReviewModal(null)}>
                Close
              </button>
            </div>

            {currentRole !== "customer" ? (
              <div className="review-panel-note">
                <strong>Customer sign-in required</strong>
                <p>{activeReviewLockedText}</p>
                <div className="review-modal-actions">
                  <Link className="button" href={`/login?next=${encodeURIComponent(`/products/${product.id}`)}`}>
                    Sign in
                  </Link>
                </div>
              </div>
            ) : activeReviewStatus?.canReview ? (
              <div className="review-composer review-modal-form">
                <div className="review-composer-head">
                  <div>
                    <strong>
                      {activeReviewStatus.existingReview ? "Update your review" : "Leave a review"}
                    </strong>
                    <p className="muted">{activeReviewLockedText}</p>
                  </div>
                  <RatingStars
                    value={isShopReviewModal ? shopReviewRating : reviewRating}
                    size="lg"
                    interactive
                    showValue={false}
                    onChange={isShopReviewModal ? setShopReviewRating : setReviewRating}
                  />
                </div>
                <div className="field">
                  <label>Comment</label>
                  <textarea
                    rows={5}
                    className="review-modal-textarea"
                    placeholder={activeReviewPlaceholder}
                    value={isShopReviewModal ? shopReviewComment : reviewComment}
                    onChange={(event) =>
                      isShopReviewModal ? setShopReviewComment(event.target.value) : setReviewComment(event.target.value)
                    }
                  />
                </div>
                {activeReviewMessage ? <div className="message">{activeReviewMessage}</div> : null}
                <div className="review-modal-actions">
                  <button
                    type="button"
                    className="button"
                    disabled={activeReviewSaving}
                    onClick={() => void (isShopReviewModal ? submitShopReview() : submitReview())}
                  >
                    {activeReviewSaving
                      ? "Saving..."
                      : activeReviewStatus.existingReview
                        ? "Update review"
                        : "Publish review"}
                  </button>
                  <button type="button" className="button-secondary" onClick={() => setReviewModal(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="review-panel-note">
                <strong>Review locked</strong>
                <p>{activeReviewLockedText}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
