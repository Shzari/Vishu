"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useCart } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import { ProductMedia } from "@/components/product-media";
import type { CustomerAccount, CustomerOrder } from "@/lib/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { items, clearCart } = useCart();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specialRequest, setSpecialRequest] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "card">(
    "cash_on_delivery",
  );
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    async function loadAccount() {
      if (!token || user?.role !== "customer") {
        setAccount(null);
        setAccountLoading(false);
        return;
      }

      try {
        setAccountLoading(true);
        const data = await apiRequest<CustomerAccount>("/account/me", undefined, token);
        setAccount(data);
        const defaultAddress = data.addresses.find((entry) => entry.isDefault) ?? data.addresses[0];
        const defaultCard =
          data.paymentMethods.find((entry) => entry.isDefault) ?? data.paymentMethods[0];
        setSelectedAddressId(defaultAddress?.id ?? "");
        setSelectedPaymentMethodId(defaultCard?.id ?? "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load checkout data.");
      } finally {
        setAccountLoading(false);
      }
    }

    void loadAccount();
  }, [token, user]);

  async function placeOrder() {
    setError(null);
    setMessage(null);

    if (!token || user?.role !== "customer") {
      setError("Please login as a customer before checking out.");
      return;
    }

    if (!selectedAddressId) {
      setError("Please choose a saved delivery address before checkout.");
      return;
    }

    if (paymentMethod === "card" && !selectedPaymentMethodId) {
      setError("Please choose a saved card before placing a prepaid order.");
      return;
    }

    try {
      const response = await apiRequest<CustomerOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          specialRequest,
          addressId: selectedAddressId,
          paymentMethod,
          paymentMethodId: paymentMethod === "card" ? selectedPaymentMethodId : undefined,
        }),
      }, token);

      setMessage(`Order ${response.id} created successfully.`);
      clearCart();
      router.push("/orders");
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
    }
  }

  return (
    <RequireRole requiredRole="customer">
      <div className="split">
      <section className="form-card stack">
        <div className="catalog-toolbar compact-toolbar">
          <div>
            <h1 className="section-title">Checkout</h1>
            <p className="muted">Finish this order or step back into the catalog if you need more items.</p>
          </div>
          <div className="catalog-meta">
            <Link className="table-link" href="/cart">
              Back to cart
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
          <div
            key={item.productId}
            className="card"
            style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "1rem" }}
          >
            <div style={{ borderRadius: "18px", overflow: "hidden", minHeight: "110px" }}>
              <ProductMedia
                title={item.title}
                image={assetUrl(item.image)}
                subtitle="Ready for checkout"
                className="card-image"
              />
            </div>
            <div className="stack">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <Link href={`/products/${item.productId}`} className="product-title-link">
                  {item.title}
                </Link>
                <strong>{formatCurrency(item.price * item.quantity)}</strong>
              </div>
              <p className="muted">
                {item.quantity} x {formatCurrency(item.price)}
              </p>
            </div>
          </div>
        ))}
        <section className="card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between" }}>
            <strong>Delivery address</strong>
            <Link className="table-link" href="/account">
              Manage addresses
            </Link>
          </div>
          {accountLoading ? (
            <p className="muted">Loading saved addresses...</p>
          ) : account?.addresses.length ? (
            <div className="stack">
              {account.addresses.map((address) => (
                <label key={address.id} className="card">
                  <div className="checkbox-row" style={{ alignItems: "flex-start" }}>
                    <input
                      type="radio"
                      name="selectedAddress"
                      checked={selectedAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                    />
                    <div className="stack" style={{ gap: "0.2rem" }}>
                      <strong>
                        {address.label}
                        {address.isDefault ? " · Default" : ""}
                      </strong>
                      <span className="muted">
                        {address.fullName}
                        {address.phoneNumber ? ` | ${address.phoneNumber}` : ""}
                      </span>
                      <span className="muted">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                        {`, ${address.city}`}
                        {address.stateRegion ? `, ${address.stateRegion}` : ""}
                        {`, ${address.postalCode}, ${address.country}`}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="message">
              Save at least one delivery address in your account before placing an order.
            </div>
          )}
        </section>
        <div className="field">
          <label>Special request</label>
          <textarea
            placeholder="Sizing notes, packaging request, delivery note, or other customer instructions"
            value={specialRequest}
            onChange={(event) => setSpecialRequest(event.target.value)}
          />
        </div>
        <section className="card">
          <strong>Purchase type</strong>
          <label className="checkbox-row">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "cash_on_delivery"}
              onChange={() => setPaymentMethod("cash_on_delivery")}
            />
            Cash on delivery
          </label>
          <label className="checkbox-row">
            <input
              type="radio"
              name="paymentMethod"
              checked={paymentMethod === "card"}
              onChange={() => setPaymentMethod("card")}
            />
            Card or prepaid order
          </label>
          {paymentMethod === "cash_on_delivery" && (
            <div className="message">
              Pay in cash when the order arrives. Admin and vendors will track this order as COD.
            </div>
          )}
          {paymentMethod === "card" && (
            <div className="stack">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <strong>Saved card</strong>
                <Link className="table-link" href="/account">
                  Manage cards
                </Link>
              </div>
              {accountLoading ? (
                <p className="muted">Loading saved cards...</p>
              ) : account?.paymentMethods.length ? (
                account.paymentMethods.map((method) => (
                  <label key={method.id} className="card">
                    <div className="checkbox-row" style={{ alignItems: "flex-start" }}>
                      <input
                        type="radio"
                        name="selectedPaymentMethod"
                        checked={selectedPaymentMethodId === method.id}
                        onChange={() => setSelectedPaymentMethodId(method.id)}
                      />
                      <div className="stack" style={{ gap: "0.2rem" }}>
                        <strong>
                          {method.nickname || `${method.brand} ending ${method.last4}`}
                          {method.isDefault ? " · Default" : ""}
                        </strong>
                        <span className="muted">
                          {method.cardholderName} | {method.brand} •••• {method.last4}
                        </span>
                        <span className="muted">
                          Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                        </span>
                      </div>
                    </div>
                  </label>
                ))
              ) : (
                <div className="message">
                  Save at least one card in your account before using prepaid checkout.
                </div>
              )}
            </div>
          )}
        </section>
      </section>

      <aside className="form-card stack">
        <h2 className="section-title">Order Summary</h2>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Distinct products</span>
          <strong>{items.length}</strong>
        </div>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Total units</span>
          <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
        </div>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div className="card">
          <strong>{paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Prepaid order"}</strong>
          <p className="muted">
            {paymentMethod === "cash_on_delivery"
              ? "Customer pays on arrival. Good fit for local purchase habits."
              : "Order is marked as paid during checkout."}
          </p>
        </div>
        <div className="card">
          <strong>Delivery snapshot</strong>
          {selectedAddressId && account?.addresses.find((entry) => entry.id === selectedAddressId) ? (
            <p className="muted">
              {account.addresses.find((entry) => entry.id === selectedAddressId)?.label}
              {" · "}
              {account.addresses.find((entry) => entry.id === selectedAddressId)?.city}
            </p>
          ) : (
            <p className="muted">No saved address selected yet.</p>
          )}
          {paymentMethod === "card" && (
            <p className="muted">
              {selectedPaymentMethodId &&
              account?.paymentMethods.find((entry) => entry.id === selectedPaymentMethodId)
                ? `${account.paymentMethods.find((entry) => entry.id === selectedPaymentMethodId)?.brand} ending ${account.paymentMethods.find((entry) => entry.id === selectedPaymentMethodId)?.last4}`
                : "No saved card selected yet."}
            </p>
          )}
        </div>
        <button className="button" type="button" onClick={placeOrder} disabled={items.length === 0}>
          Place order
        </button>
        <Link href="/" className="button-secondary">
          Continue Shopping
        </Link>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </aside>
      </div>
    </RequireRole>
  );
}
