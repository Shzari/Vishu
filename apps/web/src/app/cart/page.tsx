"use client";

import Link from "next/link";
import { useCart } from "@/components/providers";
import { assetUrl, formatCurrency } from "@/lib/api";
import { ProductMedia } from "@/components/product-media";

export default function CartPage() {
  const { items, updateItemQuantity, removeItem } = useCart();
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="split">
      <section className="form-card stack">
        <div className="catalog-toolbar compact-toolbar">
          <div>
            <h1 className="section-title">Your Cart</h1>
            <p className="muted">Keep reviewing items or jump back into the marketplace.</p>
          </div>
          <div className="catalog-meta">
            <Link className="table-link" href="/">
              Continue shopping
            </Link>
          </div>
        </div>
        {items.length === 0 && (
          <div className="empty stack">
            <span>Your cart is empty.</span>
            <Link href="/" className="button">
              Browse products
            </Link>
          </div>
        )}
        {items.map((item) => (
          <div key={item.productId} className="card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <div style={{ borderRadius: "18px", overflow: "hidden", minHeight: "120px" }}>
                <ProductMedia
                  title={item.title}
                  image={assetUrl(item.image)}
                  subtitle="Saved in cart"
                  className="card-image"
                />
              </div>
              <div className="stack">
                <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <Link href={`/products/${item.productId}`} className="product-title-link">
                      {item.title}
                    </Link>
                    <p className="muted">{formatCurrency(item.price)} each</p>
                  </div>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => removeItem(item.productId)}
                  >
                    Remove
                  </button>
                </div>
                <div className="inline-actions">
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                  >
                    -
                  </button>
                  <span className="chip">Qty {item.quantity}</span>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                  >
                    +
                  </button>
                  <span className="chip">Stock {item.stock}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <aside className="form-card stack">
        <h2 className="section-title">Summary</h2>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Items</span>
          <strong>{items.length}</strong>
        </div>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Total units</span>
          <strong>{units}</strong>
        </div>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <Link href="/checkout" className="button">
          Proceed to Checkout
        </Link>
        <Link href="/" className="button-secondary">
          Continue Shopping
        </Link>
      </aside>
    </div>
  );
}
