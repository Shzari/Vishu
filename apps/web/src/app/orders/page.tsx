"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const loadOrders = useCallback(async () => {
    if (!token || currentRole !== "customer") {
      return;
    }

    try {
      const data = await apiRequest<CustomerOrder[]>("/orders/my", undefined, token);
      setOrders(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders.");
    }
  }, [currentRole, token]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

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
      <div className="stack customer-orders-page">
        <section className="panel hero-panel customer-orders-hero">
          <span className="chip">Customer history</span>
          <h1 className="hero-title">Track every order in one place.</h1>
          <p className="hero-copy">
            Each order stays customer-safe: you can review items, pricing, and shipping progress
            without exposing vendor identity in the storefront experience.
          </p>
          <div className="mini-stats customer-orders-stats">
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
          <article key={order.id} className="form-card stack customer-order-card">
            <div className="customer-order-head">
              <div className="customer-order-head-main">
                <strong>Order {order.orderNumber}</strong>
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
              <div className="chip-row customer-order-head-side">
                <StatusBadge status={order.status} />
                <span className="chip">{formatCurrency(order.totalPrice)}</span>
              </div>
            </div>

            <div className="customer-order-timeline">{timelineFor(order)}</div>

            <div className="message customer-order-note">{progressNote(order)}</div>

            {(order.shippingAddress || order.paymentCard) && (
              <div className="customer-order-summary-grid">
                {order.shippingAddress && (
                  <div className="card stack customer-order-summary-card">
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
                  <div className="card stack customer-order-summary-card">
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

            <div className="customer-order-items">
              {order.items.map((item) => (
                <div key={item.id} className="customer-order-item">
                  <Link href={`/products/${item.product.id}`} className="customer-order-item-media">
                    <div className="product-thumb customer-order-product-thumb">
                      <div className="product-media-shell">
                        <ProductMedia
                          title={item.product.title}
                          image={assetUrl(item.product.images[0])}
                          subtitle={`${item.product.category} order item`}
                        />
                      </div>
                    </div>
                  </Link>
                  <div className="customer-order-item-content">
                    <Link href={`/products/${item.product.id}`} className="product-title-link customer-order-item-title">
                      {item.product.title}
                    </Link>
                    <p className="muted customer-order-item-copy">
                      {item.product.category} | Qty {item.quantity} | {formatCurrency(item.unitPrice)}
                    </p>
                    {item.shipment?.trackingNumber && (
                      <p className="muted customer-order-item-copy">
                        Shipment: {item.shipment.shippingCarrier || "Carrier pending"} |{" "}
                        {item.shipment.trackingNumber}
                        {item.shipment.shippedAt
                          ? ` | ${new Date(item.shipment.shippedAt).toLocaleString()}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="customer-order-item-side">
                    <strong className="customer-order-item-total">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </strong>
                    <div className="customer-order-item-status">
                      <StatusBadge status={item.status} />
                    </div>
                    {item.status === "delivered" ? (
                      <Link className="table-link customer-order-review-link" href={`/products/${item.product.id}`}>
                        Rate item
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="customer-order-footer">
              <div className="stack customer-order-footer-main">
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
          </article>
        ))}
      </div>
    </RequireRole>
  );
}
