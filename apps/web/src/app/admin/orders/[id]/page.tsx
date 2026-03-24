"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import type { AdminOrderRow } from "@/lib/types";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [detail, setDetail] = useState<AdminOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codStatus, setCodStatus] = useState<"cod_pending" | "cod_collected" | "cod_refused">("cod_pending");
  const [codNote, setCodNote] = useState("");
  const [codSaving, setCodSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDetail() {
    if (!token || user?.role !== "admin") {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextDetail = await apiRequest<AdminOrderRow>(`/admin/orders/${params.id}`, undefined, token);
      setDetail(nextDetail);
      if (nextDetail.paymentMethod === "cash_on_delivery") {
        setCodStatus(
          nextDetail.paymentStatus === "cod_collected" || nextDetail.paymentStatus === "cod_refused"
            ? nextDetail.paymentStatus
            : "cod_pending",
        );
      }
      setCodNote(nextDetail.codStatusNote ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load order detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [params.id, token, user]);

  async function updateCodStatus() {
    if (!token || detail?.paymentMethod !== "cash_on_delivery") {
      return;
    }

    try {
      setCodSaving(true);
      setMessage(null);
      setError(null);
      const nextDetail = await apiRequest<AdminOrderRow>(
        `/admin/orders/${params.id}/cod`,
        {
          method: "PATCH",
          body: JSON.stringify({
            paymentStatus: codStatus,
            note: codNote.trim() || undefined,
          }),
        },
        token,
      );
      setDetail(nextDetail);
      setCodStatus(
        nextDetail.paymentStatus === "cod_collected" || nextDetail.paymentStatus === "cod_refused"
          ? nextDetail.paymentStatus
          : "cod_pending",
      );
      setCodNote(nextDetail.codStatusNote ?? "");
      setMessage("COD status updated.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update COD status.");
    } finally {
      setCodSaving(false);
    }
  }

  if (loading) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message">Loading order detail...</div>
      </RequireRole>
    );
  }

  if (error || !detail) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message error">{error ?? "Order not found."}</div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="stack">
      {message && <div className="message success">{message}</div>}
      {error && !loading && <div className="message error">{error}</div>}
      <section className="panel hero-panel">
        <span className="chip">Order detail</span>
        <h1 className="hero-title">Order {detail.id}</h1>
        <p className="hero-copy">
          Inspect customer identity, line items, vendor attribution, COD state, and commission details in one place.
        </p>
        <div className="chip-row" style={{ marginTop: "1rem" }}>
          <StatusBadge status={detail.status} />
          <span className="chip">{formatCurrency(detail.totalPrice)}</span>
          <span className="chip">
            {detail.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online"}
          </span>
        </div>
        {detail.specialRequest && (
          <p className="hero-copy" style={{ marginTop: "1rem" }}>
            Special request: {detail.specialRequest}
          </p>
        )}
        {detail.cancelRequest?.status === "requested" && (
          <div className="message" style={{ marginTop: "1rem" }}>
            Customer cancel requested
            {detail.cancelRequest.requestedAt
              ? ` on ${new Date(detail.cancelRequest.requestedAt).toLocaleString()}`
              : ""}
            {detail.cancelRequest.note ? `. Note: ${detail.cancelRequest.note}` : "."}
          </div>
        )}
        {detail.codStatusNote && (
          <p className="hero-copy" style={{ marginTop: "0.5rem" }}>
            COD note: {detail.codStatusNote}
          </p>
        )}
      </section>

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Order Summary</h2>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{detail.items.length}</strong>
              <span className="muted">Line items</span>
            </div>
            <div className="mini-stat">
              <strong>{detail.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
              <span className="muted">Units</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(detail.items.reduce((sum, item) => sum + item.commission, 0))}</strong>
              <span className="muted">Commission</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(detail.items.reduce((sum, item) => sum + item.vendorEarnings, 0))}</strong>
              <span className="muted">Vendor value</span>
            </div>
          </div>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Customer</h2>
          <div className="card">
            <strong>{detail.customerEmail}</strong>
            <p className="muted">{new Date(detail.createdAt).toLocaleString()}</p>
            <p className="muted">
              {detail.paymentStatus === "cod_pending"
                ? "Payment pending at delivery"
                : detail.paymentStatus === "cod_collected"
                  ? "Cash collected"
                  : detail.paymentStatus === "cod_refused"
                    ? "Delivery refused"
                    : "Payment settled"}
            </p>
            {detail.codUpdatedAt && (
              <p className="muted">COD updated {new Date(detail.codUpdatedAt).toLocaleString()}</p>
            )}
            <div className="inline-actions">
              <Link className="button-secondary" href="/admin/dashboard?view=orders">
                Open order queue
              </Link>
              <Link className="button-ghost" href={`/admin/dashboard?view=shipping&shippingFilter=${detail.status === "delivered" ? "delivered" : "shipped"}`}>
                Open shipping queue
              </Link>
            </div>
          </div>
        </div>

        {detail.paymentMethod === "cash_on_delivery" && (
          <div className="form-card stack">
            <h2 className="section-title">COD Controls</h2>
            <p className="muted">
              Update the cash-on-delivery payment state after delivery follow-up or collection confirmation.
            </p>
            <div className="field">
              <label>COD payment status</label>
              <select
                value={codStatus}
                onChange={(event) =>
                  setCodStatus(event.target.value as "cod_pending" | "cod_collected" | "cod_refused")
                }
              >
                <option value="cod_pending">Pending collection</option>
                <option value="cod_collected">Cash collected</option>
                <option value="cod_refused">Delivery refused</option>
              </select>
            </div>
            <div className="field">
              <label>Admin note</label>
              <textarea
                className="input"
                rows={3}
                value={codNote}
                onChange={(event) => setCodNote(event.target.value)}
                placeholder="Optional COD note for delivery outcome or collection follow-up"
              />
            </div>
            <div className="inline-actions">
              <button className="button" type="button" disabled={codSaving} onClick={() => void updateCodStatus()}>
                {codSaving ? "Saving..." : "Save COD update"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="form-card stack">
        <h2 className="section-title">Line Items</h2>
        {detail.items.map((item) => (
          <div key={item.id} className="card">
            <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{item.product.title}</strong>
                <p className="muted">
                  {item.product.productCode ? `${item.product.productCode} | ` : ""}
                  {item.product.category}
                  {item.product.color ? ` | ${item.product.color}` : ""}
                  {item.product.size ? ` | ${item.product.size}` : ""}
                  {` | ${item.quantity} x ${formatCurrency(item.unitPrice)}`}
                </p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            <div className="order-summary-grid">
              <div className="mini-stat">
                <strong>{formatCurrency(item.commission)}</strong>
                <span className="muted">Commission</span>
              </div>
              <div className="mini-stat">
                <strong>{formatCurrency(item.vendorEarnings)}</strong>
                <span className="muted">Vendor earnings</span>
              </div>
              <div className="mini-stat">
                <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
                <span className="muted">Gross line total</span>
              </div>
            </div>
            {item.shipment?.trackingNumber && (
              <div className="card">
                <strong>Shipment</strong>
                <p className="muted">
                  {item.shipment.shippingCarrier || "Carrier pending"} | {item.shipment.trackingNumber}
                </p>
                {item.shipment.shippedAt && (
                  <p className="muted">
                    Shipped {new Date(item.shipment.shippedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <div className="inline-actions">
              <span className="muted">Vendor:</span>
              <Link className="table-link" href={`/admin/vendors/${item.vendor.id}`}>
                {item.vendor.shopName}
              </Link>
            </div>
          </div>
        ))}
      </section>

      <Link className="button-ghost" href="/admin/dashboard">
        Back to admin dashboard
      </Link>
      </div>
    </RequireRole>
  );
}
