"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import { ProductMedia } from "@/components/product-media";
import { StatusBadge } from "@/components/status-badge";
import type { CustomerOrder } from "@/lib/types";

export default function OrdersPage() {
  const { token, currentRole } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [cancelNotes, setCancelNotes] = useState<Record<string, string>>({});
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    if (!token || currentRole !== "customer") {
      return;
    }

    try {
      const data = await apiRequest<CustomerOrder[]>("/orders/my", undefined, token);
      setOrders(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders.");
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [currentRole, token]);

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalPrice, 0),
    [orders],
  );
  const totalUnits = useMemo(
    () =>
      orders.reduce(
        (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
        0,
      ),
    [orders],
  );

  async function reorder(orderId: string) {
    if (!token) return;
    try {
      setActiveAction(`reorder-${orderId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string; addedCount: number }>(
        `/orders/${orderId}/reorder`,
        { method: "POST" },
        token,
      );
      setMessage(
        `${response.message}. ${response.addedCount} item${response.addedCount === 1 ? "" : "s"} added.`,
      );
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Reorder failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function requestCancel(orderId: string) {
    if (!token) return;
    try {
      setActiveAction(`cancel-${orderId}`);
      setMessage(null);
      setError(null);
      const nextOrder = await apiRequest<CustomerOrder>(
        `/orders/${orderId}/cancel-request`,
        {
          method: "PATCH",
          body: JSON.stringify({
            note: cancelNotes[orderId]?.trim() || undefined,
          }),
        },
        token,
      );
      setOrders((current) => current.map((order) => (order.id === orderId ? nextOrder : order)));
      setMessage("Cancel request sent.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Cancel request failed.");
    } finally {
      setActiveAction(null);
    }
  }

  function timelineFor(order: CustomerOrder) {
    const steps = [
      {
        id: "pending",
        label: "Placed",
        at: order.fulfillment?.placedAt ?? order.createdAt,
      },
      {
        id: "confirmed",
        label: "Confirmed",
        at: order.fulfillment?.confirmedAt ?? null,
      },
      {
        id: "shipped",
        label: "Shipped",
        at: order.fulfillment?.shippedAt ?? null,
      },
      {
        id: "delivered",
        label: "Delivered",
        at: order.fulfillment?.deliveredAt ?? null,
      },
    ];
    const currentIndex = steps.findIndex((step) => step.id === order.status);

    return (
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {steps.map((step, index) => (
          <div key={step.id} className={index <= currentIndex ? "card stack" : "card stack muted-panel"}>
            <strong>{step.label}</strong>
            <span className="muted">
              {step.at ? new Date(step.at).toLocaleString() : "Waiting"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function progressNote(order: CustomerOrder) {
    if (order.status === "pending") {
      return "Your order has been placed and is waiting for vendor confirmation.";
    }

    if (order.status === "confirmed") {
      return "The vendor confirmed your order and is preparing it for shipment.";
    }

    if (order.status === "shipped") {
      const trackedItem = order.items.find((item) => item.shipment?.trackingNumber);
      if (trackedItem?.shipment?.trackingNumber) {
        return `Your order is on the way. Tracking number: ${trackedItem.shipment.trackingNumber}.`;
      }

      return "Your order is on the way.";
    }

    if (order.status === "delivered") {
      return "Your order has been marked as delivered.";
    }

    return "Fulfillment is in progress.";
  }

  return (
    <RequireRole requiredRole="customer">
      <div className="stack">
        <section className="panel hero-panel">
          <span className="chip">Customer history</span>
          <h1 className="hero-title">Track every order in one place.</h1>
          <p className="hero-copy">
            Each order stays customer-safe: you can review items, pricing, and shipping progress
            without exposing vendor identity in the storefront experience.
          </p>
          <div className="mini-stats" style={{ marginTop: "1.4rem" }}>
            <div className="mini-stat">
              <strong>{orders.length}</strong>
              <span className="muted">Orders placed</span>
            </div>
            <div className="mini-stat">
              <strong>{totalUnits}</strong>
              <span className="muted">Units purchased</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(totalSpent)}</strong>
              <span className="muted">Total spent</span>
            </div>
            <div className="mini-stat">
              <strong>{orders.filter((order) => order.paymentMethod === "cash_on_delivery").length}</strong>
              <span className="muted">COD orders</span>
            </div>
          </div>
          <div className="storefront-actions">
            <Link href="/" className="button-secondary">
              Continue shopping
            </Link>
          </div>
        </section>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        {orders.length === 0 && <div className="empty">No orders yet.</div>}
        {orders.map((order) => (
          <div key={order.id} className="form-card stack">
            <div className="inline-actions" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>Order {order.id}</strong>
                <p className="muted">{new Date(order.createdAt).toLocaleString()}</p>
                {order.specialRequest && <p className="muted">Request: {order.specialRequest}</p>}
                <p className="muted">
                  {order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online"} |{" "}
                  {order.paymentStatus === "cod_pending"
                    ? "Payment pending at delivery"
                    : order.paymentStatus === "cod_collected"
                      ? "Cash collected"
                      : order.paymentStatus === "cod_refused"
                        ? "Delivery refused"
                        : "Paid"}
                </p>
                {order.cancelRequest?.status === "requested" && (
                  <p className="muted">
                    Cancel requested
                    {order.cancelRequest.requestedAt
                      ? ` | ${new Date(order.cancelRequest.requestedAt).toLocaleString()}`
                      : ""}
                    {order.cancelRequest.note ? ` | ${order.cancelRequest.note}` : ""}
                  </p>
                )}
              </div>
              <div className="chip-row">
                <StatusBadge status={order.status} />
                <span className="chip">{formatCurrency(order.totalPrice)}</span>
              </div>
            </div>

            {timelineFor(order)}

            <div className="message">{progressNote(order)}</div>

            {(order.shippingAddress || order.paymentCard) && (
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {order.shippingAddress && (
                  <div className="card stack" style={{ gap: "0.25rem" }}>
                    <strong>Delivery address</strong>
                    <span className="muted">
                      {order.shippingAddress.label || "Saved address"}
                      {order.shippingAddress.fullName ? ` | ${order.shippingAddress.fullName}` : ""}
                    </span>
                    <span className="muted">
                      {order.shippingAddress.line1}
                      {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
                    </span>
                    <span className="muted">
                      {order.shippingAddress.city}
                      {order.shippingAddress.stateRegion ? `, ${order.shippingAddress.stateRegion}` : ""}
                      {`, ${order.shippingAddress.postalCode}, ${order.shippingAddress.country}`}
                    </span>
                    {order.shippingAddress.phoneNumber && (
                      <span className="muted">{order.shippingAddress.phoneNumber}</span>
                    )}
                  </div>
                )}
                {order.paymentCard && (
                  <div className="card stack" style={{ gap: "0.25rem" }}>
                    <strong>Saved card snapshot</strong>
                    <span className="muted">
                      {order.paymentCard.nickname || `${order.paymentCard.brand} card`}
                    </span>
                    <span className="muted">
                      {order.paymentCard.cardholderName || "Cardholder"} | {order.paymentCard.brand} ****{" "}
                      {order.paymentCard.last4}
                    </span>
                  </div>
                )}
              </div>
            )}

            {order.items.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "1rem" }}
              >
                <div style={{ borderRadius: "18px", overflow: "hidden", minHeight: "120px" }}>
                  <ProductMedia
                    title={item.product.title}
                    image={assetUrl(item.product.images[0])}
                    subtitle={`${item.product.category} order item`}
                    className="card-image"
                  />
                </div>
                <div className="stack">
                  <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                    <Link href={`/products/${item.product.id}`} className="product-title-link">
                      {item.product.title}
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="muted">
                    {item.product.category} | {item.quantity} x {formatCurrency(item.unitPrice)}
                  </p>
                  {item.shipment?.trackingNumber && (
                    <p className="muted">
                      Shipment: {item.shipment.shippingCarrier || "Carrier pending"} |{" "}
                      {item.shipment.trackingNumber}
                      {item.shipment.shippedAt
                        ? ` | ${new Date(item.shipment.shippedAt).toLocaleString()}`
                        : ""}
                    </p>
                  )}
                  <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
                </div>
              </div>
            ))}

            <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="stack" style={{ gap: "0.35rem", minWidth: "280px", flex: "1 1 320px" }}>
                {order.status === "pending" && order.cancelRequest?.status !== "requested" && (
                  <>
                    <div className="field">
                      <label>Cancel request note</label>
                      <textarea
                        rows={2}
                        placeholder="Optional note for admin before confirmation"
                        value={cancelNotes[order.id] ?? ""}
                        onChange={(event) =>
                          setCancelNotes((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={activeAction !== null}
                      onClick={() => requestCancel(order.id)}
                    >
                      {activeAction === `cancel-${order.id}` ? "Sending..." : "Request cancel"}
                    </button>
                  </>
                )}
                {order.cancelRequest?.status === "requested" && (
                  <span className="badge warn">Cancel request pending review</span>
                )}
              </div>
              <button
                type="button"
                className="button"
                disabled={activeAction !== null}
                onClick={() => reorder(order.id)}
              >
                {activeAction === `reorder-${order.id}` ? "Adding..." : "Reorder to cart"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </RequireRole>
  );
}
