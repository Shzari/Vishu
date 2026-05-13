"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type { AdminVendorDetail } from "@/lib/types";

export default function AdminVendorDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, currentRole } = useAuth();
  const [detail, setDetail] = useState<AdminVendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [platformFeeMode, setPlatformFeeMode] = useState<"dynamic" | "fixed">("dynamic");
  const [platformFee, setPlatformFee] = useState("1.00");
  const [feeFreeEnabled, setFeeFreeEnabled] = useState(false);
  const [feeFreeUntil, setFeeFreeUntil] = useState("");
  const [accountSaving, setAccountSaving] = useState<"vendor" | "user" | "reset" | null>(
    null,
  );
  const [feeSaving, setFeeSaving] = useState(false);
  const feeGraceLabel = detail?.feeGraceEndsAt
    ? new Date(detail.feeGraceEndsAt).toLocaleDateString()
    : null;
  const lastActivityLabel = detail?.lastActivityAt
    ? new Date(detail.lastActivityAt).toLocaleString()
    : "No activity recorded";
  const lastLoginLabel = detail?.lastLoginAt
    ? new Date(detail.lastLoginAt).toLocaleString()
    : "No login recorded";
  const ownerMobileNumber = detail?.user.phoneNumber?.trim() || detail?.user.supportPhone?.trim() || "";

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const nextDetail = await apiRequest<AdminVendorDetail>(
          `/admin/vendors/${params.id}`,
          undefined,
          token,
        );
        setDetail(nextDetail);
        setPlatformFeeMode(nextDetail.platformFeeMode);
        setPlatformFee(Number(nextDetail.platformFee).toFixed(2));
        setFeeFreeEnabled(Boolean(nextDetail.feeFreeUntil));
        setFeeFreeUntil(nextDetail.feeFreeUntil ? nextDetail.feeFreeUntil.slice(0, 10) : "");
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load vendor detail.");
      } finally {
        setLoading(false);
      }
    }

    void loadDetail();
  }, [currentRole, params.id, token]);

  async function refreshDetail() {
    if (!token) {
      return;
    }

    const nextDetail = await apiRequest<AdminVendorDetail>(
      `/admin/vendors/${params.id}`,
      undefined,
      token,
    );
    setDetail(nextDetail);
    setPlatformFeeMode(nextDetail.platformFeeMode);
    setPlatformFee(Number(nextDetail.platformFee).toFixed(2));
    setFeeFreeEnabled(Boolean(nextDetail.feeFreeUntil));
    setFeeFreeUntil(nextDetail.feeFreeUntil ? nextDetail.feeFreeUntil.slice(0, 10) : "");
  }

  async function handleVendorActivation(nextIsActive: boolean) {
    try {
      setAccountSaving("vendor");
      setAccountMessage(null);
      setAccountError(null);
      await apiRequest(
        `/admin/vendors/${params.id}/activation`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextIsActive }),
        },
        token,
      );
      await refreshDetail();
      setAccountMessage(nextIsActive ? "Vendor activated." : "Vendor deactivated.");
    } catch (actionError) {
      setAccountError(actionError instanceof Error ? actionError.message : "Failed to update vendor.");
    } finally {
      setAccountSaving(null);
    }
  }

  async function handleUserActivation(nextIsActive: boolean) {
    if (!detail) {
      return;
    }

    try {
      setAccountSaving("user");
      setAccountMessage(null);
      setAccountError(null);
      await apiRequest(
        `/admin/users/${detail.user.id}/activation`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: nextIsActive }),
        },
        token,
      );
      await refreshDetail();
      setAccountMessage(nextIsActive ? "Vendor login enabled." : "Vendor login disabled.");
    } catch (actionError) {
      setAccountError(actionError instanceof Error ? actionError.message : "Failed to update vendor login.");
    } finally {
      setAccountSaving(null);
    }
  }

  async function handlePasswordReset() {
    if (!detail) {
      return;
    }

    try {
      setAccountSaving("reset");
      setAccountMessage(null);
      setAccountError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/users/${detail.user.id}/password-reset`,
        { method: "POST" },
        token,
      );
      setAccountMessage(response.message);
    } catch (actionError) {
      setAccountError(
        actionError instanceof Error ? actionError.message : "Failed to send reset email.",
      );
    } finally {
      setAccountSaving(null);
    }
  }

  async function handleUpdatePlatformFee() {
    if (!token) {
      return;
    }

    const fixedFee = Number(platformFee);
    if (platformFeeMode === "fixed" && (!Number.isFinite(fixedFee) || fixedFee < 0)) {
      setAccountError("Fixed fee must be a valid amount.");
      return;
    }

    if (feeFreeEnabled && !feeFreeUntil) {
      setAccountError("Choose the date when the no-fee period ends.");
      return;
    }

    try {
      setFeeSaving(true);
      setAccountMessage(null);
      setAccountError(null);
      const response = await apiRequest<{
        message: string;
        vendor: AdminVendorDetail;
      }>(
        `/admin/vendors/${params.id}/platform-fee`,
        {
          method: "PATCH",
          body: JSON.stringify({
            feeMode: platformFeeMode,
            platformFee: fixedFee,
            feeFreeUntil: feeFreeEnabled ? feeFreeUntil : undefined,
            clearFeeFreeUntil: !feeFreeEnabled,
          }),
        },
        token,
      );
      setDetail(response.vendor);
      setPlatformFeeMode(response.vendor.platformFeeMode);
      setPlatformFee(Number(response.vendor.platformFee).toFixed(2));
      setFeeFreeEnabled(Boolean(response.vendor.feeFreeUntil));
      setFeeFreeUntil(response.vendor.feeFreeUntil ? response.vendor.feeFreeUntil.slice(0, 10) : "");
      setAccountMessage(response.message);
    } catch (actionError) {
      setAccountError(
        actionError instanceof Error ? actionError.message : "Failed to update platform fee settings.",
      );
    } finally {
      setFeeSaving(false);
    }
  }

  if (loading) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message">Loading vendor detail...</div>
      </RequireRole>
    );
  }

  if (error || !detail) {
    return (
      <RequireRole requiredRole="admin">
        <div className="message error">{error ?? "Vendor not found."}</div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-vendor-detail-page">
        <section className="panel hero-panel admin-vendor-hero">
          <div className="admin-vendor-hero-main">
            <span className="chip">Vendor detail</span>
            <h1 className="hero-title">{detail.shopName}</h1>
            <p className="hero-copy">
              Review ownership, activation state, sales health, and recent fulfillment from one
              cleaner admin view.
            </p>
            <div className="chip-row">
              <StatusBadge status={detail.isActive ? "active" : "disabled"} />
              <span className="chip">{detail.isVerified ? "verified" : "unverified"}</span>
            </div>
          </div>
          <div className="admin-vendor-hero-meta">
            <div className="mini-stat">
              <strong>{detail.approvedAt ? "Approved" : "Pending"}</strong>
              <span className="muted">
                {detail.approvedAt
                  ? new Date(detail.approvedAt).toLocaleDateString()
                  : "No approval date yet"}
              </span>
            </div>
            <div className="mini-stat">
              <strong>{new Date(detail.createdAt).toLocaleDateString()}</strong>
              <span className="muted">Created</span>
            </div>
            <div className="mini-stat">
              <strong>{detail.user.isActive ? "Login enabled" : "Login disabled"}</strong>
              <span className="muted">{detail.user.email}</span>
            </div>
            <div className="mini-stat">
              <strong>Last activity</strong>
              <span className="muted">{lastActivityLabel}</span>
            </div>
          </div>
        </section>

        {accountMessage ? <div className="message success">{accountMessage}</div> : null}
        {accountError ? <div className="message error">{accountError}</div> : null}

        <div className="admin-vendor-detail-grid">
          <div className="admin-vendor-detail-main">
            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="section-title">Account controls</h2>
                  <p className="muted">
                    Manage vendor availability, login access, and password recovery without leaving
                    this screen.
                  </p>
                </div>
                <Link className="button-ghost" href={`/admin/users/${detail.user.id}`}>
                  Open user
                </Link>
              </div>
              <div className="inline-actions admin-account-controls-actions">
                <button
                  className="button"
                  type="button"
                  disabled={accountSaving !== null}
                  onClick={() => void handleVendorActivation(!detail.isActive)}
                >
                  {accountSaving === "vendor"
                    ? "Saving..."
                    : detail.isActive
                      ? "Deactivate vendor"
                      : "Activate vendor"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={accountSaving !== null}
                  onClick={() => void handleUserActivation(!detail.user.isActive)}
                >
                  {accountSaving === "user"
                    ? "Saving..."
                    : detail.user.isActive
                      ? "Disable login"
                      : "Enable login"}
                </button>
                <button
                  className="button-ghost"
                  type="button"
                  disabled={accountSaving !== null}
                  onClick={() => void handlePasswordReset()}
                >
                  {accountSaving === "reset" ? "Sending..." : "Send reset email"}
                </button>
              </div>
              <div className="mini-stats">
                <div className="mini-stat">
                  <strong>{lastActivityLabel}</strong>
                  <span className="muted">Last activity</span>
                </div>
                <div className="mini-stat">
                  <strong>{lastLoginLabel}</strong>
                  <span className="muted">Last login</span>
                </div>
                <div className="mini-stat">
                  <strong>
                    {detail.inactivityDisabledAt
                      ? new Date(detail.inactivityDisabledAt).toLocaleDateString()
                      : "Not disabled"}
                  </strong>
                  <span className="muted">Inactivity status</span>
                </div>
              </div>
            </section>

            <section className="form-card stack">
              <div>
                <h2 className="section-title">Platform Fee</h2>
                <p className="muted">
                  Dynamic vendor fee is locked when the vendor confirms their part of an order:
                  0.50 EUR up to 7 EUR, then scales to 2.00 EUR at 50 EUR, then adds 2%.
                </p>
                <p className="muted">
                  {feeGraceLabel
                    ? `This shop is still in the free period. Dynamic fees start on ${feeGraceLabel}.`
                    : "The fee is based on this vendor's accepted subtotal, not the full customer order."}
                </p>
              </div>
              <div className="form-grid two">
                <label className="field">
                  <span>Fee method</span>
                  <select
                    value={platformFeeMode}
                    onChange={(event) =>
                      setPlatformFeeMode(event.target.value as "dynamic" | "fixed")
                    }
                  >
                    <option value="dynamic">Dynamic default</option>
                    <option value="fixed">Force fixed fee</option>
                  </select>
                </label>
                <label className="field">
                  <span>Fixed fee amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={platformFee}
                    disabled={platformFeeMode !== "fixed"}
                    onChange={(event) => setPlatformFee(event.target.value)}
                  />
                </label>
              </div>
              <div className="form-grid two">
                <label className="field">
                  <span>No-fee status</span>
                  <select
                    value={feeFreeEnabled ? "free" : "normal"}
                    onChange={(event) => setFeeFreeEnabled(event.target.value === "free")}
                  >
                    <option value="normal">Fees active</option>
                    <option value="free">No fee until date</option>
                  </select>
                </label>
                <label className="field">
                  <span>No fee until</span>
                  <input
                    type="date"
                    value={feeFreeUntil}
                    disabled={!feeFreeEnabled}
                    onChange={(event) => setFeeFreeUntil(event.target.value)}
                  />
                </label>
              </div>
              <div className="inline-actions">
                <button
                  className="button"
                  type="button"
                  disabled={feeSaving}
                  onClick={() => void handleUpdatePlatformFee()}
                >
                  {feeSaving ? "Saving..." : "Save fee settings"}
                </button>
              </div>
            </section>

            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="section-title">Recent fulfillment activity</h2>
                  <p className="muted">
                    The latest vendor-side order movement with direct links back to each order.
                  </p>
                </div>
                <Link className="button-secondary" href="/admin/reports">
                  Open reports
                </Link>
              </div>
              {detail.recentOrderItems.length === 0 ? (
                <div className="empty">No recent order activity yet.</div>
              ) : (
                <div className="admin-vendor-activity-list">
                  {detail.recentOrderItems.map((item) => (
                    <div key={`${item.orderId}-${item.createdAt}`} className="card admin-vendor-activity-card">
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div className="admin-table-stack">
                          <Link className="table-link" href={`/admin/orders/${item.orderId}`}>
                            Order {item.orderNumber}
                          </Link>
                          <span className="muted">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="admin-vendor-activity-copy">
                        <strong>{item.productTitle}</strong>
                        <p className="muted">
                          {item.productCode ? `${item.productCode} - ` : ""}Qty {item.quantity}
                        </p>
                        <p className="muted">
                          Vendor earnings {formatCurrency(item.vendorEarnings)}
                        </p>
                        {item.shipment?.trackingNumber ? (
                          <p className="muted">
                            {item.shipment.shippingCarrier || "Carrier pending"} -{" "}
                            {item.shipment.trackingNumber}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="section-title">Category mix</h2>
                  <p className="muted">
                    A quick view of how this vendor catalog is distributed across categories.
                  </p>
                </div>
                <span className="chip">{detail.categories.length} categories</span>
              </div>
              {detail.categories.length === 0 ? (
                <div className="empty">No category data yet.</div>
              ) : (
                <div className="admin-vendor-category-list">
                  {detail.categories.map((entry) => (
                    <div key={entry.category} className="card admin-vendor-category-card">
                      <strong>{entry.category}</strong>
                      <span className="muted">{entry.productCount} products</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="admin-vendor-detail-sidebar">
            <section className="form-card stack">
              <div>
                <h2 className="section-title">Vendor metrics</h2>
                <p className="muted">Operational and earnings snapshot for this shop.</p>
              </div>
              <div className="admin-vendor-kpi-grid">
                <div className="mini-stat">
                  <strong>{detail.metrics.productCount}</strong>
                  <span className="muted">Products</span>
                </div>
                <div className="mini-stat">
                  <strong>{detail.metrics.inventoryUnits}</strong>
                  <span className="muted">Inventory units</span>
                </div>
                <div className="mini-stat">
                  <strong>{detail.metrics.orderCount}</strong>
                  <span className="muted">Orders touched</span>
                </div>
                <div className="mini-stat">
                  <strong>{detail.metrics.pendingItems}</strong>
                  <span className="muted">Pending items</span>
                </div>
                <div className="mini-stat">
                  <strong>{detail.metrics.shippedItems}</strong>
                  <span className="muted">Shipped items</span>
                </div>
                <div className="mini-stat">
                  <strong>{formatCurrency(detail.metrics.totalEarnings)}</strong>
                  <span className="muted">Vendor earnings</span>
                </div>
                <div className="mini-stat">
                  <strong>{formatCurrency(detail.metrics.totalCommission)}</strong>
                  <span className="muted">Platform fees generated</span>
                </div>
                <div className="mini-stat">
                  <strong>{formatCurrency(detail.metrics.paidOut)}</strong>
                  <span className="muted">Paid out</span>
                </div>
              </div>
            </section>

            <section className="form-card stack">
              <div>
                <h2 className="section-title">Ownership</h2>
                <p className="muted">Primary account and shop lifecycle timestamps.</p>
              </div>
              <div className="admin-vendor-info-list">
                <div className="card admin-vendor-info-card">
                  <strong>{detail.user.email}</strong>
                  <span className="muted">Linked user account</span>
                </div>
                <div className="card admin-vendor-info-card">
                  <strong>{ownerMobileNumber || "No mobile number saved"}</strong>
                  <span className="muted">
                    {detail.user.phoneNumber?.trim() ? "Owner mobile number" : "Shop support mobile"}
                  </span>
                </div>
                <div className="card admin-vendor-info-card">
                  <strong>{detail.approvedAt ? new Date(detail.approvedAt).toLocaleString() : "Not approved yet"}</strong>
                  <span className="muted">Approval status</span>
                </div>
                <div className="card admin-vendor-info-card">
                  <strong>{new Date(detail.updatedAt).toLocaleString()}</strong>
                  <span className="muted">Last updated</span>
                </div>
              </div>
            </section>

            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="section-title">Payout history</h2>
                  <p className="muted">Recent payouts already recorded for this vendor.</p>
                </div>
                <span className="chip">{detail.payoutHistory.length}</span>
              </div>
              {detail.payoutHistory.length === 0 ? (
                <div className="empty">No payout history yet.</div>
              ) : (
                <div className="admin-vendor-payout-list">
                  {detail.payoutHistory.map((entry) => (
                    <div key={entry.id} className="card admin-vendor-payout-card">
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{formatCurrency(entry.amount)}</strong>
                        <span className="chip">{new Date(entry.paidAt).toLocaleDateString()}</span>
                      </div>
                      <p className="muted">{entry.reference || "No reference"}</p>
                      {entry.note ? <p className="muted">{entry.note}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>

        <Link className="button-ghost" href="/admin/vendors">
          Back to vendors
        </Link>
      </div>
    </RequireRole>
  );
}
