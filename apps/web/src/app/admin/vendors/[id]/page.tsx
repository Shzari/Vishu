"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import { StatusBadge } from "@/components/status-badge";
import type { AdminVendorDetail } from "@/lib/types";

export default function AdminVendorDetailPage() {
  const params = useParams<{ id: string }>();
  const { token, currentRole } = useAuth();
  const [detail, setDetail] = useState<AdminVendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionNote, setSubscriptionNote] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionSaving, setSubscriptionSaving] = useState<"monthly" | "yearly" | "cut" | "auto" | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSaving, setAccountSaving] = useState<"vendor" | "user" | "reset" | null>(null);

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadDetail() {
      try {
        setLoading(true);
        setError(null);
        const nextDetail = await apiRequest<AdminVendorDetail>(`/admin/vendors/${params.id}`, undefined, token);
        setDetail(nextDetail);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load vendor detail.");
      } finally {
        setLoading(false);
      }
    }

    void loadDetail();
  }, [currentRole, params.id, token]);

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

  const subscription = detail.subscription ?? {
    planType: null,
    status: "inactive" as const,
    startedAt: null,
    endsAt: null,
  };
  const subscriptionHistory = detail.subscriptionHistory ?? [];

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
      const nextDetail = await apiRequest<AdminVendorDetail>(`/admin/vendors/${params.id}`, undefined, token);
      setDetail(nextDetail);
      setAccountMessage(nextIsActive ? "Vendor activated." : "Vendor deactivated.");
    } catch (actionError) {
      setAccountError(actionError instanceof Error ? actionError.message : "Failed to update vendor.");
    } finally {
      setAccountSaving(null);
    }
  }

  async function handleUserActivation(nextIsActive: boolean) {
    if (!detail) return;

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
      const nextDetail = await apiRequest<AdminVendorDetail>(`/admin/vendors/${params.id}`, undefined, token);
      setDetail(nextDetail);
      setAccountMessage(nextIsActive ? "Vendor login enabled." : "Vendor login disabled.");
    } catch (actionError) {
      setAccountError(actionError instanceof Error ? actionError.message : "Failed to update vendor login.");
    } finally {
      setAccountSaving(null);
    }
  }

  async function handlePasswordReset() {
    if (!detail) return;

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
      setAccountError(actionError instanceof Error ? actionError.message : "Failed to send reset email.");
    } finally {
      setAccountSaving(null);
    }
  }

  async function handleSubscriptionAction(action: "monthly" | "yearly" | "cut" | "auto") {
    try {
      setSubscriptionSaving(action);
      setSubscriptionMessage(null);
      setSubscriptionError(null);
      const nextDetail = await apiRequest<AdminVendorDetail>(
        `/admin/vendors/${params.id}/subscription`,
        {
          method: "PATCH",
          body: JSON.stringify(
            action === "cut"
              ? { status: "expired", note: subscriptionNote.trim() || undefined }
              : action === "auto"
                ? { status: "auto", note: subscriptionNote.trim() || undefined }
                : { status: "active", planType: action, note: subscriptionNote.trim() || undefined },
          ),
        },
        token,
      );
      setDetail(nextDetail);
      setSubscriptionNote("");
      setSubscriptionMessage(
        action === "cut"
          ? "Vendor listing access was cut successfully."
          : action === "auto"
            ? "Vendor returned to the automatic subscription plan."
          : `${action === "monthly" ? "Monthly" : "Yearly"} plan enabled manually.`,
      );
    } catch (actionError) {
      setSubscriptionError(
        actionError instanceof Error ? actionError.message : "Failed to update subscription.",
      );
    } finally {
      setSubscriptionSaving(null);
    }
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="stack">
      <section className="panel hero-panel">
        <span className="chip">Vendor detail</span>
        <h1 className="hero-title">{detail.shopName}</h1>
        <p className="hero-copy">
          Review onboarding state, user ownership, category mix, and fulfillment activity without opening the storefront tools.
        </p>
        <div className="chip-row" style={{ marginTop: "1rem" }}>
          <StatusBadge status={detail.isActive ? "active" : "disabled"} />
          <span className="chip">{detail.isVerified ? "verified" : "unverified"}</span>
        </div>
      </section>

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Subscription</h2>
          <p className="muted">
            Manually grant a listing plan even without payment, or cut the shop off if the contract ends or the shop fails.
          </p>
          <label className="stack" style={{ gap: "0.35rem" }}>
            <span className="muted">Admin note</span>
            <textarea
              className="input"
              rows={3}
              value={subscriptionNote}
              onChange={(event) => setSubscriptionNote(event.target.value)}
              placeholder="Optional note: manual grant, contract ended, shop failed..."
            />
          </label>
          <div className="inline-actions">
            <button
              className="button"
              type="button"
              disabled={subscriptionSaving !== null}
              onClick={() => void handleSubscriptionAction("monthly")}
            >
              {subscriptionSaving === "monthly" ? "Saving..." : "Enable monthly"}
            </button>
            <button
              className="button-ghost"
              type="button"
              disabled={subscriptionSaving !== null}
              onClick={() => void handleSubscriptionAction("yearly")}
            >
              {subscriptionSaving === "yearly" ? "Saving..." : "Enable yearly"}
            </button>
            <button
              className="button-ghost"
              type="button"
              disabled={subscriptionSaving !== null}
              onClick={() => void handleSubscriptionAction("cut")}
            >
              {subscriptionSaving === "cut" ? "Saving..." : "Cut listing"}
            </button>
            <button
              className="button-ghost"
              type="button"
              disabled={subscriptionSaving !== null}
              onClick={() => void handleSubscriptionAction("auto")}
            >
              {subscriptionSaving === "auto" ? "Saving..." : "Return to automatic"}
            </button>
          </div>
          {subscriptionMessage && <div className="message">{subscriptionMessage}</div>}
          {subscriptionError && <div className="message error">{subscriptionError}</div>}
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{subscription.status}</strong>
              <span className="muted">Status</span>
            </div>
            <div className="mini-stat">
              <strong>{subscription.planType ?? "No plan"}</strong>
              <span className="muted">Current plan</span>
            </div>
            <div className="mini-stat">
              <strong>{subscription.endsAt ? new Date(subscription.endsAt).toLocaleDateString() : "Not set"}</strong>
              <span className="muted">Visible until</span>
            </div>
            <div className="mini-stat">
              <strong>{subscription.source === "manual_override" ? "Manual override" : "Automatic"}</strong>
              <span className="muted">Control mode</span>
            </div>
          </div>
          <div className="card">
            <strong>Automatic subscription</strong>
            <p className="muted">
              {detail.automaticSubscription.planType ?? "No plan"} | {detail.automaticSubscription.status}
            </p>
            <p className="muted">
              {detail.automaticSubscription.endsAt
                ? `Base visibility until ${new Date(detail.automaticSubscription.endsAt).toLocaleDateString()}`
                : "No automatic visibility window"}
            </p>
          </div>
          {detail.manualOverride && (
            <div className="card">
              <strong>Manual override</strong>
              <p className="muted">
                {detail.manualOverride.planType ?? "No plan"} | {detail.manualOverride.status}
              </p>
              <p className="muted">
                {detail.manualOverride.endsAt
                  ? `Override until ${new Date(detail.manualOverride.endsAt).toLocaleDateString()}`
                  : "Override end not set"}
              </p>
              {detail.manualOverride.note && <p className="muted">{detail.manualOverride.note}</p>}
            </div>
          )}
          {subscriptionHistory.length === 0 && <div className="empty">No subscription history yet.</div>}
          {subscriptionHistory.map((entry) => (
            <div key={entry.id} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <strong>{entry.planType} plan</strong>
                <span className={entry.status === "active" ? "badge" : "badge warn"}>{entry.status}</span>
              </div>
              <p className="muted">
                {formatCurrency(entry.amount)} | {new Date(entry.startsAt).toLocaleDateString()} to {new Date(entry.endsAt).toLocaleDateString()}
              </p>
              {(entry.adminNote || entry.adminEmail) && (
                <p className="muted">
                  {entry.adminNote ?? "Manual admin change"}
                  {entry.adminEmail ? ` | ${entry.adminEmail}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Vendor Metrics</h2>
          <div className="mini-stats">
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
              <strong>{formatCurrency(detail.metrics.totalEarnings)}</strong>
              <span className="muted">Vendor earnings</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(detail.metrics.totalCommission)}</strong>
              <span className="muted">Commission generated</span>
            </div>
            <div className="mini-stat">
              <strong>{detail.metrics.pendingItems}</strong>
              <span className="muted">Pending items</span>
            </div>
          </div>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Account Controls</h2>
          {accountMessage && <div className="message success">{accountMessage}</div>}
          {accountError && <div className="message error">{accountError}</div>}
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
              <strong>{detail.isActive ? "Live" : "Disabled"}</strong>
              <span className="muted">Vendor access</span>
            </div>
            <div className="mini-stat">
              <strong>{detail.user.isActive ? "Enabled" : "Disabled"}</strong>
              <span className="muted">Login access</span>
            </div>
          </div>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Ownership</h2>
          <div className="card">
            <strong>{detail.user.email}</strong>
            <p className="muted">Linked user account</p>
            <Link className="button-ghost" href={`/admin/users/${detail.user.id}`}>
              Open user record
            </Link>
          </div>
          <div className="card">
            <strong>Approved</strong>
            <p className="muted">
              {detail.approvedAt ? new Date(detail.approvedAt).toLocaleString() : "Not approved yet"}
            </p>
          </div>
          <div className="card">
            <strong>Created</strong>
            <p className="muted">{new Date(detail.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </section>

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Category Mix</h2>
          {detail.categories.length === 0 && <div className="empty">No category data yet.</div>}
          {detail.categories.map((entry) => (
            <div key={entry.category} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <strong>{entry.category}</strong>
                <span className="chip">{entry.productCount} products</span>
              </div>
            </div>
          ))}
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Recent Fulfillment Activity</h2>
          {detail.recentOrderItems.length === 0 && <div className="empty">No recent order activity yet.</div>}
          {detail.recentOrderItems.map((item) => (
            <div key={`${item.orderId}-${item.createdAt}`} className="card">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <div>
                  <Link className="table-link" href={`/admin/orders/${item.orderId}`}>
                    Order {item.orderId}
                  </Link>
                  <p className="muted">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="muted">
                    {item.productCode ? `${item.productCode} | ` : ""}
                    {item.productTitle}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <p className="muted">
                quantity {item.quantity} | vendor earnings {formatCurrency(item.vendorEarnings)}
              </p>
              {item.shipment?.trackingNumber && (
                <p className="muted">
                  {item.shipment.shippingCarrier || "Carrier pending"} | {item.shipment.trackingNumber}
                </p>
              )}
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
