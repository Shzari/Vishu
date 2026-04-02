"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import { useAuth, useCart } from "@/components/providers";
import type { CustomerAccount, CustomerOrder } from "@/lib/types";

const emptyCheckoutForm = {
  fullName: "",
  email: "",
  phoneNumber: "",
  city: "",
  addressLine1: "",
  apartmentOrNote: "",
  specialRequest: "",
};

export default function CheckoutPage() {
  const { token, currentRole } = useAuth();
  const { items, clearCart } = useCart();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [form, setForm] = useState(emptyCheckoutForm);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<CustomerOrder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = currentRole === "customer" && Boolean(token);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const canPlaceOrder =
    items.length > 0 &&
    form.fullName.trim() &&
    form.email.trim() &&
    form.phoneNumber.trim() &&
    form.city.trim() &&
    form.addressLine1.trim();

  useEffect(() => {
    async function loadAccount() {
      if (!token || currentRole !== "customer") {
        setAccount(null);
        return;
      }

      try {
        setAccountLoading(true);
        const data = await apiRequest<CustomerAccount>("/account/me", undefined, token);
        setAccount(data);

        const defaultAddress =
          data.addresses.find((entry) => entry.isDefault) ?? data.addresses[0] ?? null;

        setForm((current) => ({
          ...current,
          fullName: current.fullName || data.profile.fullName || "",
          email: current.email || data.profile.email || "",
          phoneNumber: current.phoneNumber || data.profile.phoneNumber || defaultAddress?.phoneNumber || "",
          city: current.city || defaultAddress?.city || "",
          addressLine1: current.addressLine1 || defaultAddress?.line1 || "",
          apartmentOrNote: current.apartmentOrNote || defaultAddress?.line2 || "",
        }));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load saved checkout details.",
        );
      } finally {
        setAccountLoading(false);
      }
    }

    void loadAccount();
  }, [currentRole, token]);

  const summaryItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        total: item.price * item.quantity,
      })),
    [items],
  );

  async function placeOrder() {
    if (!canPlaceOrder) {
      setError("Please complete the contact and delivery details first.");
      return;
    }

    try {
      setPlacingOrder(true);
      setError(null);
      setMessage(null);

      const payload = {
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        city: form.city.trim(),
        addressLine1: form.addressLine1.trim(),
        apartmentOrNote: form.apartmentOrNote.trim() || undefined,
        specialRequest: form.specialRequest.trim() || undefined,
        paymentMethod: "cash_on_delivery" as const,
      };

      const response = await apiRequest<CustomerOrder>(
        isCustomer ? "/orders" : "/orders/guest",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        isCustomer ? token ?? undefined : undefined,
      );

      setPlacedOrder(response);
      clearCart();
      setMessage(
        isCustomer
          ? `Order ${response.id} placed successfully.`
          : `Guest order ${response.id} placed successfully.`,
      );
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout failed.",
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  if (placedOrder) {
    return (
      <div className="checkout-shell">
        <section className="checkout-main checkout-success-panel">
          <span className="checkout-kicker">Order placed</span>
          <h1 className="checkout-title">Your order is confirmed.</h1>
          <p className="checkout-copy">
            We saved your delivery details and order snapshot. A seller or courier
            will contact you about delivery.
          </p>

          <div className="checkout-success-meta">
            <div className="checkout-success-row">
              <span>Order number</span>
              <strong>{placedOrder.orderNumber}</strong>
            </div>
            <div className="checkout-success-row">
              <span>Total</span>
              <strong>{formatCurrency(placedOrder.totalPrice)}</strong>
            </div>
            <div className="checkout-success-row">
              <span>Payment</span>
              <strong>Cash on delivery</strong>
            </div>
          </div>

          {!isCustomer ? (
            <div className="checkout-guest-followup">
              <strong>Check your email for two updates.</strong>
              <p>
                We sent your order confirmation separately. If this email is new to
                Vishu.shop, we also created an account for it and sent an activation
                link so you can set a password, track orders, and manage future
                purchases.
              </p>
              <div className="checkout-success-actions">
                <Link href="/reset-password" className="button">
                  Activate account
                </Link>
                <Link href="/login" className="button-secondary">
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <div className="checkout-success-actions">
              <Link href="/orders" className="button">
                View my orders
              </Link>
              <Link href="/" className="button-secondary">
                Continue shopping
              </Link>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="checkout-shell">
      <section className="checkout-main">
        <div className="checkout-head">
          <div>
            <span className="checkout-kicker">Checkout</span>
            <h1 className="checkout-title">Fast local checkout</h1>
            <p className="checkout-copy">
              Guest checkout is open by default. Sign in only if you want faster
              reuse of saved details.
            </p>
          </div>
          <div className="checkout-head-actions">
            {!isCustomer ? (
              <>
                <Link className="table-link" href="/login">
                  Sign in
                </Link>
                <Link className="table-link" href="/register">
                  Create account
                </Link>
              </>
            ) : (
              <Link className="table-link" href="/account">
                Saved account details
              </Link>
            )}
          </div>
        </div>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}

        {items.length === 0 ? (
          <div className="checkout-empty">
            <strong>Your cart is empty.</strong>
            <p>Add products first, then come back to complete your order.</p>
            <Link href="/" className="button">
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Contact</h2>
                <p>We use these details for delivery updates and order follow-up.</p>
              </div>

              <div className="checkout-form-grid">
                <label className="field">
                  <span>Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder="Full name"
                  />
                </label>

                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="you@example.com"
                  />
                </label>

                <label className="field">
                  <span>Phone number</span>
                  <input
                    value={form.phoneNumber}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phoneNumber: event.target.value,
                      }))
                    }
                    placeholder="Phone number"
                  />
                </label>
              </div>
            </section>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Delivery details</h2>
                <p>Only the essentials for local delivery.</p>
              </div>

              <div className="checkout-form-grid">
                <label className="field">
                  <span>City</span>
                  <input
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    placeholder="City"
                  />
                </label>

                <label className="field checkout-field-wide">
                  <span>Address</span>
                  <input
                    value={form.addressLine1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: event.target.value,
                      }))
                    }
                    placeholder="Street and building"
                  />
                </label>

                <label className="field checkout-field-wide">
                  <span>Apartment or delivery note</span>
                  <input
                    value={form.apartmentOrNote}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        apartmentOrNote: event.target.value,
                      }))
                    }
                    placeholder="Apartment, floor, or local delivery note"
                  />
                </label>

                <label className="field checkout-field-wide">
                  <span>Order note</span>
                  <textarea
                    value={form.specialRequest}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        specialRequest: event.target.value,
                      }))
                    }
                    placeholder="Optional delivery or packaging note"
                  />
                </label>
              </div>
            </section>

            <section className="checkout-section">
              <div className="checkout-section-head">
                <h2>Payment method</h2>
                <p>Cash on delivery is the default for this marketplace.</p>
              </div>

              <label className="checkout-payment-choice">
                <input type="radio" checked readOnly />
                <div>
                  <strong>Cash on delivery</strong>
                  <p>
                    Pay when the order arrives. Shipping and taxes are confirmed
                    during delivery handling.
                  </p>
                </div>
              </label>

              {isCustomer && accountLoading ? (
                <p className="muted">Loading saved details…</p>
              ) : null}
            </section>
          </>
        )}
      </section>

      <aside className="checkout-summary">
        <div className="checkout-summary-card">
          <div className="checkout-summary-head">
            <h2>Order summary</h2>
            <span>{totalUnits} units</span>
          </div>

          <div className="checkout-summary-list">
            {summaryItems.map((item) => (
              <div key={item.productId} className="checkout-summary-item">
                <div className="checkout-summary-item-media">
                  {item.image ? (
                    <img
                      src={assetUrl(item.image)}
                      alt={item.title}
                      className="checkout-summary-item-image"
                    />
                  ) : (
                    <span className="checkout-summary-item-placeholder">
                      Vishu
                    </span>
                  )}
                </div>
                <div className="checkout-summary-item-copy">
                  <strong>{item.title}</strong>
                  {(item.color || item.size) && (
                    <span className="checkout-summary-item-meta">
                      {[item.color, item.size].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <span className="checkout-summary-item-total">
                    Qty {item.quantity} · {formatCurrency(item.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="checkout-summary-totals">
            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="checkout-summary-row">
              <span>Total</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
          </div>

          <p className="checkout-summary-note">
            Shipping and taxes are finalized during delivery confirmation.
          </p>

          <button
            className="button checkout-submit"
            type="button"
            onClick={placeOrder}
            disabled={!canPlaceOrder || placingOrder || items.length === 0}
          >
            {placingOrder ? "Placing order..." : "Place order"}
          </button>

          <Link href="/cart" className="button-secondary checkout-back-link">
            Back to cart
          </Link>
        </div>
      </aside>
    </div>
  );
}
