"use client";

import Link from "next/link";
import { useCart } from "@/components/providers";
import { assetUrl, formatCurrency } from "@/lib/api";

export default function CartPage() {
  const { items, updateItemQuantity, removeItem } = useCart();
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <div className="cart-page-shell">
      <section className="cart-page-main">
        <div className="cart-page-head">
          <div>
            <h1 className="section-title">Cart</h1>
            <p className="muted">
              Review your items and move quickly to checkout.
            </p>
          </div>
          <Link className="table-link" href="/">
            Continue shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="cart-page-empty">
            <strong>Your cart is empty.</strong>
            <p>Browse the marketplace and add products to start checking out.</p>
            <Link href="/" className="button">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="cart-page-list">
            {items.map((item) => (
              <article key={item.productId} className="cart-page-item">
                <Link
                  href={`/products/${item.productId}`}
                  className="cart-page-item-media"
                >
                  {item.image ? (
                    <img
                      src={assetUrl(item.image)}
                      alt={item.title}
                      className="cart-page-item-image"
                    />
                  ) : (
                    <span className="cart-page-item-placeholder">Vishu</span>
                  )}
                </Link>

                <div className="cart-page-item-copy">
                  <div className="cart-page-item-top">
                    <Link
                      href={`/products/${item.productId}`}
                      className="cart-page-item-title"
                    >
                      {item.title}
                    </Link>
                    <strong className="cart-page-item-total">
                      {formatCurrency(item.price * item.quantity)}
                    </strong>
                  </div>

                  {item.color || item.size ? (
                    <div className="cart-page-item-meta">
                      {[item.color, item.size].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}

                  <div className="cart-page-item-actions">
                    <div className="cart-page-qty">
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQuantity(item.productId, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItemQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="cart-page-remove"
                      onClick={() => removeItem(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="cart-page-summary">
        <div className="cart-page-summary-block">
          <h2>Summary</h2>
          <div className="cart-page-summary-row">
            <span>Subtotal</span>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
          <p className="cart-page-summary-note">
            Shipping and taxes are calculated at checkout.
          </p>
        </div>

        <Link
          href={items.length === 0 ? "/" : "/checkout"}
          className="button cart-page-checkout"
        >
          {items.length === 0 ? "Browse products" : "Proceed to checkout"}
        </Link>
      </aside>
    </div>
  );
}
