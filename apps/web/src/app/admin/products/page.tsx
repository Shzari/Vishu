"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import type { AdminProductOption, PaginatedResponse } from "@/lib/types";

type ProductStatusFilter = "under_review" | "approved" | "blocked" | "all";

function getProductStatus(product: AdminProductOption) {
  const status = product.adminStatus ?? "approved";

  if (status === "blocked") {
    return { label: "Declined", className: "admin-status-pill rejected" };
  }

  if (status === "under_review") {
    return { label: "Needs review", className: "admin-status-pill pending" };
  }

  if (product.isListed === false) {
    return { label: "Approved hidden", className: "admin-status-pill inactive" };
  }

  return { label: "Approved visible", className: "admin-status-pill active" };
}

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<AdminProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("under_review");
  const [search, setSearch] = useState("");
  const [declineNotes, setDeclineNotes] = useState<Record<string, string>>({});
  const [selectedProduct, setSelectedProduct] = useState<AdminProductOption | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  async function loadProducts() {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<PaginatedResponse<AdminProductOption>>(
        "/admin/products?page=1&pageSize=100",
        undefined,
        token,
      );
      setProducts(response.items);
      setDeclineNotes((current) => {
        const next = { ...current };
        for (const product of response.items) {
          if (next[product.id] === undefined) {
            next[product.id] = product.adminBlockReason ?? "";
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [token]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeProductReview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProduct]);

  const summary = useMemo(
    () => ({
      all: products.length,
      underReview: products.filter((product) => product.adminStatus === "under_review").length,
      approved: products.filter((product) => (product.adminStatus ?? "approved") === "approved").length,
      blocked: products.filter((product) => product.adminStatus === "blocked").length,
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const status = product.adminStatus ?? "approved";
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        product.title,
        product.productCode,
        product.shopName,
        product.category,
        product.color,
        product.size,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [products, search, statusFilter]);

  async function approveProduct(productId: string) {
    if (!token) {
      return;
    }

    try {
      setActiveAction(`approve-${productId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/products/${productId}/approve`,
        { method: "PATCH" },
        token,
      );
      setMessage(response.message);
      await loadProducts();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to approve product.");
    } finally {
      setActiveAction(null);
    }
  }

  async function declineProduct(productId: string) {
    if (!token) {
      return;
    }

    const reason = declineNotes[productId]?.trim() ?? "";
    if (!reason) {
      setError("Write a comment explaining what is wrong before declining.");
      return;
    }

    try {
      setActiveAction(`decline-${productId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/products/${productId}/block`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isBlocked: true,
            reason,
          }),
        },
        token,
      );
      setMessage(response.message);
      await loadProducts();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to decline product.");
    } finally {
      setActiveAction(null);
    }
  }

  function openProductReview(product: AdminProductOption) {
    const images = product.imageUrls?.length
      ? product.imageUrls
      : product.imageUrl
        ? [product.imageUrl]
        : [];
    setSelectedProduct(product);
    setSelectedImage(images[0] ?? null);
  }

  function closeProductReview() {
    setSelectedProduct(null);
    setSelectedImage(null);
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-products-page stack">
        <section className="panel hero-panel admin-dashboard-hero">
          <div>
            <span className="chip">Product review</span>
            <h1 className="hero-title">Products</h1>
            <p className="hero-copy">
              Review vendor uploads before they become public. Approve good listings or decline
              with a clear comment for the vendor.
            </p>
          </div>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{summary.underReview}</strong>
              <span className="muted">Need review</span>
            </div>
            <div className="mini-stat">
              <strong>{summary.approved}</strong>
              <span className="muted">Approved</span>
            </div>
            <div className="mini-stat">
              <strong>{summary.blocked}</strong>
              <span className="muted">Declined</span>
            </div>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        <section className="form-card stack">
          <div className="admin-products-toolbar">
            <label className="field">
              <span>Search products</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, shop, code, category"
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ProductStatusFilter)}
              >
                <option value="under_review">Needs review</option>
                <option value="approved">Approved</option>
                <option value="blocked">Declined</option>
                <option value="all">All products</option>
              </select>
            </label>
            <span className="chip">{filteredProducts.length} shown</span>
          </div>

          {loading ? (
            <div className="message">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty">No products match this filter.</div>
          ) : (
            <div className="table-wrap">
              <table className="admin-simple-table admin-products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Shop</th>
                    <th>Status</th>
                    <th>Stock</th>
                    <th>Price</th>
                    <th>Review comment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const status = getProductStatus(product);
                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="admin-product-cell">
                            {product.imageUrl ? (
                              <img src={assetUrl(product.imageUrl)} alt="" />
                            ) : (
                              <div className="admin-product-placeholder">No image</div>
                            )}
                            <div className="admin-table-stack">
                              <strong>{product.title}</strong>
                              <span className="muted">{product.productCode || "Code pending"}</span>
                              <span className="muted">
                                {product.department ? `${product.department} | ` : ""}
                                {product.category}
                                {product.color ? ` | ${product.color}` : ""}
                                {product.size ? ` | ${product.size}` : ""}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Link className="table-link" href={`/admin/vendors/${product.vendorId}`}>
                            {product.shopName}
                          </Link>
                        </td>
                        <td>
                          <span className={status.className}>{status.label}</span>
                          {product.adminBlockReason ? (
                            <p className="muted">{product.adminBlockReason}</p>
                          ) : null}
                        </td>
                        <td>{product.stock}</td>
                        <td>{formatCurrency(product.price)}</td>
                        <td>
                          <textarea
                            className="input admin-product-review-note"
                            rows={3}
                            value={declineNotes[product.id] ?? ""}
                            onChange={(event) =>
                              setDeclineNotes((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                            placeholder="Write what needs to be fixed before declining"
                          />
                        </td>
                        <td>
                          <div className="admin-table-actions">
                            <button
                              className="button-ghost"
                              type="button"
                              onClick={() => openProductReview(product)}
                            >
                              View photos
                            </button>
                            <Link
                              className="button-ghost"
                              href={`/products/${product.id}`}
                              target="_blank"
                            >
                              Open product
                            </Link>
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void approveProduct(product.id)}
                            >
                              {activeAction === `approve-${product.id}` ? "Approving..." : "Approve"}
                            </button>
                            <button
                              className="danger-button"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void declineProduct(product.id)}
                            >
                              {activeAction === `decline-${product.id}` ? "Declining..." : "Decline"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedProduct ? (
          <div
            className="admin-product-review-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Review ${selectedProduct.title}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeProductReview();
              }
            }}
          >
            <div className="admin-product-review-modal">
              <div className="admin-product-review-modal-head">
                <div>
                  <span className={getProductStatus(selectedProduct).className}>
                    {getProductStatus(selectedProduct).label}
                  </span>
                  <h2>{selectedProduct.title}</h2>
                  <p className="muted">
                    {selectedProduct.shopName} | {selectedProduct.productCode || "Code pending"}
                  </p>
                </div>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={closeProductReview}
                >
                  Close
                </button>
              </div>

              <div className="admin-product-review-modal-body">
                <div className="admin-product-review-gallery">
                  <div className="admin-product-review-main-image">
                    {selectedImage ? (
                      <img src={assetUrl(selectedImage)} alt={selectedProduct.title} />
                    ) : (
                      <div className="admin-product-placeholder">No image</div>
                    )}
                  </div>
                  {(selectedProduct.imageUrls?.length ?? 0) > 1 ? (
                    <div className="admin-product-review-thumbs">
                      {selectedProduct.imageUrls?.map((image, index) => (
                        <button
                          key={`${image}-${index}`}
                          type="button"
                          className={image === selectedImage ? "selected" : ""}
                          onClick={() => setSelectedImage(image)}
                          aria-label={`Show photo ${index + 1}`}
                        >
                          <img src={assetUrl(image)} alt="" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="admin-product-review-details">
                  <dl>
                    <div>
                      <dt>Category</dt>
                      <dd>
                        {selectedProduct.department ? `${selectedProduct.department} | ` : ""}
                        {selectedProduct.category}
                      </dd>
                    </div>
                    <div>
                      <dt>Color / size</dt>
                      <dd>
                        {[selectedProduct.color, selectedProduct.size]
                          .filter(Boolean)
                          .join(" | ") || "Not set"}
                      </dd>
                    </div>
                    <div>
                      <dt>Stock</dt>
                      <dd>{selectedProduct.stock}</dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd>{formatCurrency(selectedProduct.price)}</dd>
                    </div>
                  </dl>

                  <label className="field">
                    <span>Review comment</span>
                    <textarea
                      className="input admin-product-review-note"
                      rows={4}
                      value={declineNotes[selectedProduct.id] ?? ""}
                      onChange={(event) =>
                        setDeclineNotes((current) => ({
                          ...current,
                          [selectedProduct.id]: event.target.value,
                        }))
                      }
                      placeholder="Write what needs to be fixed before declining"
                    />
                  </label>

                  <div className="admin-table-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => void approveProduct(selectedProduct.id)}
                    >
                      {activeAction === `approve-${selectedProduct.id}` ? "Approving..." : "Approve"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => void declineProduct(selectedProduct.id)}
                    >
                      {activeAction === `decline-${selectedProduct.id}` ? "Declining..." : "Decline"}
                    </button>
                    <Link
                      className="button-ghost"
                      href={`/products/${selectedProduct.id}`}
                      target="_blank"
                    >
                      Open product
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RequireRole>
  );
}
