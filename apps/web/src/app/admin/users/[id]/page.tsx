"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import type { AdminUserDetail } from "@/lib/types";

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, currentRole } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionSaving, setActionSaving] = useState<"activation" | "reset" | "vendorActivation" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadDetail() {
    if (!token || currentRole !== "admin") {
      return;
    }

    try {
      setLoading(true);
      const nextDetail = await apiRequest<AdminUserDetail>(`/admin/users/${params.id}`, undefined, token);
      setDetail(nextDetail);
      setEmail(nextDetail.email);
      setPhoneNumber(nextDetail.phoneNumber ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load user detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDetail();
  }, [currentRole, params.id, token]);

  async function saveContact() {
    if (!token) return;

    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const nextDetail = await apiRequest<AdminUserDetail>(
        `/admin/users/${params.id}/contact`,
        {
          method: "PATCH",
          body: JSON.stringify({
            email,
            phoneNumber: phoneNumber.trim().length ? phoneNumber : null,
          }),
        },
        token,
      );
      setDetail(nextDetail);
      setEmail(nextDetail.email);
      setPhoneNumber(nextDetail.phoneNumber ?? "");
      setMessage("Contact information updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update contact details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUserActivation(nextIsActive: boolean) {
    if (!token) return;

    try {
      setActionSaving("activation");
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/users/${params.id}/activation`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextIsActive }),
        },
        token,
      );
      await loadDetail();
      setMessage(nextIsActive ? "User login enabled." : "User login disabled.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update account status.");
    } finally {
      setActionSaving(null);
    }
  }

  async function handlePasswordReset() {
    if (!token) return;

    try {
      setActionSaving("reset");
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/users/${params.id}/password-reset`,
        { method: "POST" },
        token,
      );
      setMessage(response.message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to send reset email.");
    } finally {
      setActionSaving(null);
    }
  }

  async function handleVendorActivation(nextIsActive: boolean) {
    if (!token || !detail?.vendor) return;

    try {
      setActionSaving("vendorActivation");
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/vendors/${detail.vendor.id}/activation`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextIsActive }),
        },
        token,
      );
      await loadDetail();
      setMessage(nextIsActive ? "Linked vendor activated." : "Linked vendor deactivated.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update vendor status.");
    } finally {
      setActionSaving(null);
    }
  }

  if (loading) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message">Loading user detail...</div>
      </RequireRole>
    );
  }

  if (error && !detail) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message error">{error}</div>
      </RequireRole>
    );
  }

  if (!detail) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message error">User not found.</div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="stack">
      <section className="panel hero-panel">
        <span className="chip">User detail</span>
        <h1 className="hero-title">{detail.email}</h1>
        <p className="hero-copy">
          Review account status, contact data, recent purchases, current cart contents, and linked vendor information from one admin page.
        </p>
        <div className="chip-row" style={{ marginTop: "1rem" }}>
          <StatusBadge status={detail.isActive ? "active" : "disabled"} />
          <span className="chip">{detail.role}</span>
        </div>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Contact & Account</h2>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label>Phone number</label>
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </div>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{detail.customer.orderCount}</strong>
              <span className="muted">Customer orders</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(detail.customer.totalSpend)}</strong>
              <span className="muted">Customer spend</span>
            </div>
          </div>
          <div className="inline-actions">
            <button className="button" type="button" disabled={saving} onClick={saveContact}>
              {saving ? "Saving..." : "Save contact"}
            </button>
            <button
              className="button-secondary"
              type="button"
              disabled={actionSaving !== null}
              onClick={() => void handleUserActivation(!detail.isActive)}
            >
              {actionSaving === "activation"
                ? "Saving..."
                : detail.isActive
                  ? "Disable login"
                  : "Enable login"}
            </button>
            <button
              className="button-ghost"
              type="button"
              disabled={actionSaving !== null}
              onClick={() => void handlePasswordReset()}
            >
              {actionSaving === "reset" ? "Sending..." : "Send reset email"}
            </button>
          </div>
          <div className="stack">
            <div className="card">
              <strong>Created</strong>
              <p className="muted">{new Date(detail.createdAt).toLocaleString()}</p>
            </div>
            <div className="card">
              <strong>Last updated</strong>
              <p className="muted">{new Date(detail.updatedAt).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Vendor Link</h2>
          {!detail.vendor && <div className="empty">This user is not linked to a vendor profile.</div>}
          {detail.vendor && (
            <>
              <div className="mini-stats">
                <div className="mini-stat">
                  <strong>{detail.vendor.productCount}</strong>
                  <span className="muted">Products</span>
                </div>
                <div className="mini-stat">
                  <strong>{detail.vendor.orderCount}</strong>
                  <span className="muted">Vendor orders</span>
                </div>
                <div className="mini-stat">
                  <strong>{formatCurrency(detail.vendor.totalEarnings)}</strong>
                  <span className="muted">Vendor earnings</span>
                </div>
              </div>
              <div className="card">
                <strong>{detail.vendor.shopName}</strong>
                <p className="muted">
                  verified: {String(detail.vendor.isVerified)} | active: {String(detail.vendor.isActive)}
                </p>
                <p className="muted">
                  approved: {detail.vendor.approvedAt ? new Date(detail.vendor.approvedAt).toLocaleString() : "Not yet"}
                </p>
              </div>
              <div className="inline-actions">
                <button
                  className="button-secondary"
                  type="button"
                  disabled={actionSaving !== null}
                  onClick={() => void handleVendorActivation(!detail.vendor!.isActive)}
                >
                  {actionSaving === "vendorActivation"
                    ? "Saving..."
                    : detail.vendor.isActive
                      ? "Deactivate vendor"
                      : "Activate vendor"}
                </button>
              </div>
              <Link className="button" href={`/admin/vendors/${detail.vendor.id}`}>
                Open vendor detail
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Current Cart</h2>
          {detail.customer.cart.itemCount === 0 && <div className="empty">No persisted cart items right now.</div>}
          {detail.customer.cart.items.map((item) => (
            <div key={item.productId} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">
                    {item.category} | qty {item.quantity}
                  </p>
                  <p className="muted">Updated {new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                <strong>{formatCurrency(item.price * item.quantity)}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Purchase History</h2>
          {detail.customer.recentOrders.length === 0 && <div className="empty">No purchases yet.</div>}
          {detail.customer.recentOrders.map((order) => (
            <div key={order.id} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <Link className="table-link" href={`/admin/orders/${order.id}`}>
                    Order {order.orderNumber}
                  </Link>
                  <p className="muted">{new Date(order.createdAt).toLocaleString()}</p>
                  {order.specialRequest && <p className="muted">Request: {order.specialRequest}</p>}
                </div>
                <div className="chip-row">
                  <StatusBadge status={order.status} />
                  <span className="chip">{formatCurrency(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link className="button-ghost" href="/admin/dashboard">
        Back to admin dashboard
      </Link>
      </div>
    </RequireRole>
  );
}
