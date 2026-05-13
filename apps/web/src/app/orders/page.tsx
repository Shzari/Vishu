"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProductMedia } from "@/components/product-media";
import { useAuth, useCart } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import type { CartItem, CustomerOrder } from "@/lib/types";

interface ReorderResponse {
  message: string;
  addedCount: number;
  cart: {
    items: {
      productId: string;
      quantity: number;
      product: {
        title: string;
        price: number;
        stock: number;
        images: string[];
      };
    }[];
  };
}

const activeStatuses = new Set(["pending", "confirmed", "shipped"]);

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPayment(order: CustomerOrder) {
  if (order.paymentMethod === "cash_on_delivery") {
    if (order.paymentStatus === "cod_collected") {
      return "COD collected";
    }
    if (order.paymentStatus === "cod_refused") {
      return "COD refused";
    }
    return "COD on delivery";
  }

  return order.paymentStatus === "paid" ? "Card paid" : "Card payment";
}

function getOrderUnits(order: CustomerOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function getCurrentStep(order: CustomerOrder) {
  if (order.status === "delivered") {
    return {
      label: "Delivered",
      date: order.fulfillment?.deliveredAt,
    };
  }

  if (order.status === "shipped") {
    return {
      label: "Shipped",
      date: order.fulfillment?.shippedAt,
    };
  }

  if (order.status === "confirmed") {
    return {
      label: "Preparing",
      date: order.fulfillment?.confirmedAt,
    };
  }

  return {
    label: "Placed",
    date: order.fulfillment?.placedAt ?? order.createdAt,
  };
}

function getOrderTimeline(order: CustomerOrder) {
  return [
    {
      key: "placed",
      label: "Placed",
      date: order.fulfillment?.placedAt ?? order.createdAt,
      complete: true,
    },
    {
      key: "confirmed",
      label: "Preparing",
      date: order.fulfillment?.confirmedAt,
      complete: ["confirmed", "shipped", "delivered"].includes(order.status),
    },
    {
      key: "shipped",
      label: "Shipped",
      date: order.fulfillment?.shippedAt,
      complete: ["shipped", "delivered"].includes(order.status),
    },
    {
      key: "delivered",
      label: "Delivered",
      date: order.fulfillment?.deliveredAt,
      complete: order.status === "delivered",
    },
  ];
}

function getDeliveryLine(order: CustomerOrder) {
  if (!order.shippingAddress) {
    return "Delivery address not saved";
  }

  return [
    order.shippingAddress.line1,
    order.shippingAddress.line2,
    order.shippingAddress.city,
    order.shippingAddress.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function OrdersPage() {
  const { token, currentRole } = useAuth();
  const { syncItems, openCart } = useCart();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [cancelNotes, setCancelNotes] = useState<Record<string, string>>({});
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
      if (!token || (currentRole !== "customer" && currentRole !== "vendor")) {
      return;
    }

    try {
      setError(null);
      const data = await apiRequest<CustomerOrder[]>("/orders/my", undefined, token);
      setOrders(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load orders.");
    }
  }, [currentRole, token]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const requestedOrderId = searchParams.get("order");
    if (!requestedOrderId) {
      return;
    }

    setExpandedOrderId(requestedOrderId);
  }, [searchParams]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      ),
    [orders],
  );
  const activeOrders = useMemo(
    () => sortedOrders.filter((order) => activeStatuses.has(order.status)),
    [sortedOrders],
  );
  const pastOrders = useMemo(
    () => sortedOrders.filter((order) => !activeStatuses.has(order.status)),
    [sortedOrders],
  );
  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalPrice, 0),
    [orders],
  );
  const totalUnits = useMemo(
    () => orders.reduce((sum, order) => sum + getOrderUnits(order), 0),
    [orders],
  );

  async function reorder(orderId: string) {
    if (!token) return;

    try {
      setActiveAction(`reorder-${orderId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<ReorderResponse>(
        `/orders/${orderId}/reorder`,
        { method: "POST" },
        token,
      );
      const nextCartItems: CartItem[] = response.cart.items.map((item) => ({
        productId: item.productId,
        title: item.product.title,
        price: item.product.price,
        image: item.product.images[0],
        quantity: item.quantity,
        stock: item.product.stock,
      }));
      syncItems(nextCartItems);
      setMessage(
        `${response.addedCount} item${response.addedCount === 1 ? "" : "s"} added to cart.`,
      );
      openCart();
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
      setCancelNotes((current) => ({ ...current, [orderId]: "" }));
      setMessage("Cancel request sent.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Cancel request failed.");
    } finally {
      setActiveAction(null);
    }
  }

  function renderOrderCard(order: CustomerOrder) {
    const step = getCurrentStep(order);
    const timeline = getOrderTimeline(order);
    const isExpanded = expandedOrderId === order.id;

    return (
      <article
        key={order.id}
        className={`form-card stack customer-order-card${isExpanded ? " is-expanded" : ""}`}
      >
        <button
          type="button"
          className="customer-order-toggle"
          aria-expanded={isExpanded}
          aria-controls={`order-details-${order.id}`}
          onClick={() => setExpandedOrderId((current) => (current === order.id ? null : order.id))}
        >
          <div className="customer-order-head-main">
            <span className="customer-order-number">{order.orderNumber}</span>
            <strong>{step.label}</strong>
            <span className="muted">{formatDateTime(step.date)}</span>
          </div>
          <div className="chip-row customer-order-head-side">
            <StatusBadge status={order.status} />
            <span className="chip">{formatPayment(order)}</span>
            <span className="chip">
              {getOrderUnits(order)} unit{getOrderUnits(order) === 1 ? "" : "s"}
            </span>
            <span className="chip">{formatCurrency(order.totalPrice)}</span>
            <span className="customer-order-expand-label">
              {isExpanded ? "Hide" : "Open"}
            </span>
          </div>
        </button>

        {isExpanded ? (
          <div id={`order-details-${order.id}`} className="customer-order-details">
            <div className="customer-order-detail-head">
              <div>
                <span className="customer-order-number">Order detail</span>
                <h2>{order.orderNumber}</h2>
              </div>
              <div className="chip-row customer-order-detail-status">
                <StatusBadge status={order.status} />
                <span className="chip">{formatPayment(order)}</span>
              </div>
            </div>

            <div className="customer-order-quick-grid">
              <div>
                <span>Total items</span>
                <strong>
                  {getOrderUnits(order)} unit{getOrderUnits(order) === 1 ? "" : "s"}
                </strong>
              </div>
              <div>
                <span>Delivery city</span>
                <strong>{order.shippingAddress?.city || "Not set"}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{formatPayment(order)}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>{formatCurrency(order.totalPrice)}</strong>
              </div>
            </div>

            <div className="customer-order-timeline" aria-label="Order progress">
              {timeline.map((entry) => (
                <div
                  key={entry.key}
                  className={
                    entry.complete
                      ? "customer-order-timeline-step is-complete"
                      : "customer-order-timeline-step"
                  }
                >
                  <span className="customer-order-timeline-dot" aria-hidden="true" />
                  <strong>{entry.label}</strong>
                  <span>{entry.date ? formatDateTime(entry.date) : "Waiting"}</span>
                </div>
              ))}
            </div>

            {order.cancelRequest?.status === "requested" ? (
              <div className="message customer-order-note">
                Cancel requested {formatDateTime(order.cancelRequest.requestedAt)}
              </div>
            ) : null}

            <div className="customer-order-summary-grid">
              <div className="customer-order-summary-card">
                <span>Delivery address</span>
                <strong>{order.shippingAddress?.fullName || "Customer"}</strong>
                <p>{getDeliveryLine(order)}</p>
                {order.shippingAddress?.phoneNumber ? <p>{order.shippingAddress.phoneNumber}</p> : null}
              </div>
              <div className="customer-order-summary-card">
                <span>Payment</span>
                <strong>{formatPayment(order)}</strong>
                <p>
                  {order.paymentCard?.last4
                    ? `${order.paymentCard.brand || "Card"} ending ${order.paymentCard.last4}`
                    : order.paymentMethod === "cash_on_delivery"
                      ? "Cash is collected when the order is delivered."
                      : "Payment details are attached to this order."}
                </p>
                {order.codStatusNote ? <p>{order.codStatusNote}</p> : null}
              </div>
            </div>

            <div className="customer-order-items-head">
              <div>
                <span className="customer-order-number">Items</span>
                <strong>
                  {order.items.length} product{order.items.length === 1 ? "" : "s"} in this order
                </strong>
              </div>
            </div>
            <div className="customer-order-items">
              {order.items.map((item) => (
                <div key={item.id} className="customer-order-item">
                  <Link href={`/products/${item.product.id}`} className="customer-order-item-media">
                    <div className="product-thumb customer-order-product-thumb">
                      <div className="product-media-shell">
                        <ProductMedia
                          title={item.product.title}
                          image={assetUrl(item.product.images[0])}
                          subtitle={item.product.category}
                        />
                      </div>
                    </div>
                  </Link>
                  <div className="customer-order-item-content">
                    <Link href={`/products/${item.product.id}`} className="product-title-link customer-order-item-title">
                      {item.product.title}
                    </Link>
                    <span className="muted customer-order-item-copy">
                      {item.product.category}
                    </span>
                  </div>
                  <div className="customer-order-item-side">
                    <strong className="customer-order-item-total">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </strong>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>

            <div className="customer-order-footer">
              <div className="stack customer-order-footer-main">
                {order.status === "pending" && order.cancelRequest?.status !== "requested" ? (
                  <>
                    <label className="field">
                      <span>Cancel note</span>
                      <textarea
                        rows={2}
                        placeholder="Optional note"
                        value={cancelNotes[order.id] ?? ""}
                        onChange={(event) =>
                          setCancelNotes((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={activeAction !== null}
                      onClick={() => void requestCancel(order.id)}
                    >
                      {activeAction === `cancel-${order.id}` ? "Sending..." : "Request cancel"}
                    </button>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                className="button"
                disabled={activeAction !== null}
                onClick={() => void reorder(order.id)}
              >
                {activeAction === `reorder-${order.id}` ? "Adding..." : "Reorder"}
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  }

  return (
      <RequireRole requiredRole="customer" allowedRoles={["customer", "vendor"]}>
      <div className="stack customer-orders-page">
        <section className="panel customer-orders-toolbar">
          <div>
            <span className="chip">My orders</span>
            <h1 className="customer-orders-title">Orders</h1>
          </div>
          <div className="mini-stats customer-orders-stats">
            <div className="mini-stat">
              <strong>{activeOrders.length}</strong>
              <span className="muted">Active</span>
            </div>
            <div className="mini-stat">
              <strong>{orders.length}</strong>
              <span className="muted">Total</span>
            </div>
            <div className="mini-stat">
              <strong>{totalUnits}</strong>
              <span className="muted">Units</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(totalSpent)}</strong>
              <span className="muted">Spent</span>
            </div>
          </div>
          <Link href="/" className="button-secondary">
            Continue shopping
          </Link>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        {orders.length === 0 ? (
          <div className="empty">No orders yet.</div>
        ) : (
          <>
            {activeOrders.length > 0 ? (
              <section className="stack customer-orders-section">
                <div className="customer-orders-section-head">
                  <strong>Active orders</strong>
                  <span className="muted">{activeOrders.length}</span>
                </div>
                {activeOrders.map(renderOrderCard)}
              </section>
            ) : null}

            {pastOrders.length > 0 ? (
              <section className="stack customer-orders-section">
                <div className="customer-orders-section-head">
                  <strong>Past orders</strong>
                  <span className="muted">{pastOrders.length}</span>
                </div>
                {pastOrders.map(renderOrderCard)}
              </section>
            ) : null}
          </>
        )}
      </div>
    </RequireRole>
  );
}
