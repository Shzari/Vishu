"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useCart } from "@/components/providers";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogDepartmentDisplayLabel,
  isCatalogDepartmentVisible,
} from "@/lib/catalog";
import { ProductMedia } from "@/components/product-media";
import type { Product } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();

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

  return (
    <div className="product-detail-shell stack">
      <div className="product-detail-top-links">
        <Link className="table-link" href={categoryBrowseHref}>
          Back to {formatCatalogLabel(product.category)}
        </Link>
        <Link className="table-link" href="/shops">
          Browse shops
        </Link>
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
          <div className="product-detail-price">{formatCurrency(product.price)}</div>
          <div className="product-stock detail-stock">
            {product.stock > 0 ? `In stock: ${product.stock}` : "Currently unavailable"}
          </div>
          <p className="product-detail-copy">{product.description}</p>

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
            <Link
              className="chip"
              href={categoryBrowseHref}
            >
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
            {product.color && (
              <div className="meta-row">
                <span>Color</span>
                <strong>{formatProductAttributeLabel(product.color)}</strong>
              </div>
            )}
            {product.size && (
              <div className="meta-row">
                <span>Size</span>
                <strong>{formatProductAttributeLabel(product.size)}</strong>
              </div>
            )}
            <div className="meta-row">
              <span>Storefront</span>
              <strong>Unified marketplace listing</strong>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
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
                <Link href={`/products/${entry.id}`} className="product-thumb">
                  <ProductMedia image={assetUrl(entry.images[0])} title={entry.title} />
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
                  <div className="product-actions">
                    <Link className="button-ghost product-action-link" href={`/products/${entry.id}`}>
                      Details
                    </Link>
                    <button
                      type="button"
                      className="button product-action-button"
                      onClick={() =>
                        addItem({
                          productId: entry.id,
                          title: entry.title,
                          price: entry.price,
                          image: entry.images[0],
                          color: entry.color ?? entry.colors[0]?.name ?? null,
                          size:
                            entry.size ?? entry.sizeVariants[0]?.label ?? null,
                          quantity: 1,
                          stock: entry.stock,
                        })
                      }
                      disabled={entry.stock === 0}
                    >
                      {entry.stock === 0 ? "Sold Out" : "Add to Cart"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
