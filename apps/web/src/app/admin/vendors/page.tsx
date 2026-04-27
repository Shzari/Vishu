"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type { AdminUserRow } from "@/lib/types";

export default function AdminVendorsPage() {
  const { token, currentRole } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [activationFilter, setActivationFilter] = useState("all");
  const [loginFilter, setLoginFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<AdminUserRow[]>("/admin/users", undefined, token);
      setUsers(response);
      setFeeDrafts(
        Object.fromEntries(
          response
            .filter((entry) => entry.vendor_id)
            .map((entry) => [
              entry.vendor_id as string,
              String(Number(entry.platform_fee ?? 1).toFixed(2)),
            ]),
        ),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vendors.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && currentRole === "admin") {
      void loadVendors();
    }
  }, [currentRole, loadVendors, token]);

  async function toggleVendor(vendorId: string, isActive: boolean) {
    if (!token) return;

    try {
      setActiveAction(`vendor-${vendorId}`);
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/vendors/${vendorId}/activation`,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        token,
      );
      setMessage(isActive ? "Vendor activated." : "Vendor deactivated.");
      await loadVendors();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update vendor.");
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleLogin(userId: string, isActive: boolean) {
    if (!token) return;

    try {
      setActiveAction(`user-${userId}`);
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/users/${userId}/activation`,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        token,
      );
      setMessage(isActive ? "Vendor login enabled." : "Vendor login disabled.");
      await loadVendors();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Failed to update vendor login.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function resendVerification(vendorId: string) {
    if (!token) return;

    try {
      setActiveAction(`verify-${vendorId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/vendors/${vendorId}/verification-resend`,
        { method: "POST" },
        token,
      );
      setMessage(response.message);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to resend vendor verification.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function updateVendorFee(vendorId: string) {
    if (!token) return;

    const nextFee = Number(feeDrafts[vendorId] ?? "0");
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      setError("Fee must be a number greater than or equal to 0.");
      return;
    }

    try {
      setActiveAction(`fee-${vendorId}`);
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/vendors/${vendorId}/platform-fee`,
        {
          method: "PATCH",
          body: JSON.stringify({ platformFee: nextFee }),
        },
        token,
      );
      setMessage("Vendor fee updated.");
      await loadVendors();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to update vendor fee.");
    } finally {
      setActiveAction(null);
    }
  }

  const vendors = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users
      .filter((entry) => entry.vendor_id)
      .filter((entry) => {
        const matchesSearch =
          !term ||
          `${entry.email} ${entry.shop_name ?? ""}`.toLowerCase().includes(term);
        const matchesVerification =
          verificationFilter === "all" ||
          (verificationFilter === "verified" && Boolean(entry.vendor_verified)) ||
          (verificationFilter === "pending" &&
            Boolean(entry.vendor_verified) &&
            !Boolean(entry.vendor_active)) ||
          (verificationFilter === "unverified" && !entry.vendor_verified);
        const matchesActivation =
          activationFilter === "all" ||
          (activationFilter === "active" && Boolean(entry.vendor_active)) ||
          (activationFilter === "inactive" && !entry.vendor_active);
        const matchesLogin =
          loginFilter === "all" ||
          (loginFilter === "enabled" && entry.is_active) ||
          (loginFilter === "disabled" && !entry.is_active);

        return (
          matchesSearch &&
          matchesVerification &&
          matchesActivation &&
          matchesLogin
        );
      });
  }, [activationFilter, loginFilter, search, users, verificationFilter]);

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Vendor management</span>
            <h1 className="admin-page-title">Vendors</h1>
            <p className="admin-page-description">
              Review verification, activation, and account access from one clean marketplace
              control table.
            </p>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        <section className="form-card stack">
          <div className="admin-filter-toolbar">
            <div className="field">
              <label>Search vendors</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by shop or email"
              />
            </div>
            <div className="field">
              <label>Verification</label>
              <select
                value={verificationFilter}
                onChange={(event) => setVerificationFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="pending">Pending approval</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
            <div className="field">
              <label>Activation</label>
              <select
                value={activationFilter}
                onChange={(event) => setActivationFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="field">
              <label>Login</label>
              <select value={loginFilter} onChange={(event) => setLoginFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </section>

        <section className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className="section-title">Vendor table</h2>
              <p className="muted">{vendors.length} vendor accounts match the current filters.</p>
            </div>
          </div>

          {loading ? (
            <div className="message">Loading vendors...</div>
          ) : vendors.length === 0 ? (
            <div className="empty">No vendors match the current filters.</div>
          ) : (
            <div className="table-wrap">
              <table className="admin-simple-table">
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Verification</th>
                    <th>Activation</th>
                    <th>Login</th>
                    <th>Fee</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td>
                        <div className="admin-table-stack">
                          <strong>{vendor.shop_name ?? "Unnamed shop"}</strong>
                          <span className="muted">{vendor.email}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            vendor.vendor_verified
                              ? "admin-status-pill approved"
                              : "admin-status-pill rejected"
                          }
                        >
                          {vendor.vendor_verified ? "Verified" : "Unverified"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            vendor.vendor_active
                              ? "admin-status-pill active"
                              : vendor.vendor_verified
                                ? "admin-status-pill pending"
                                : "admin-status-pill inactive"
                          }
                        >
                          {vendor.vendor_active
                            ? "Active"
                            : vendor.vendor_verified
                              ? "Waiting"
                              : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            vendor.is_active
                              ? "admin-status-pill active"
                              : "admin-status-pill inactive"
                          }
                        >
                          {vendor.is_active ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        {vendor.vendor_id ? (
                          <div className="admin-table-stack">
                            <strong>
                              {formatCurrency(
                                Number(
                                  vendor.effective_platform_fee ?? vendor.platform_fee ?? 0,
                                ),
                              )}
                            </strong>
                            {vendor.fee_grace_ends_at ? (
                              <span className="muted">
                                Applied now: free until{" "}
                                {new Date(vendor.fee_grace_ends_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="muted">
                                Applied now: {formatCurrency(Number(vendor.platform_fee ?? 0))}
                              </span>
                            )}
                            <div
                              className="inline-actions"
                              style={{ alignItems: "center", flexWrap: "nowrap" }}
                            >
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  feeDrafts[vendor.vendor_id] ??
                                  String(Number(vendor.platform_fee ?? 1).toFixed(2))
                                }
                                onChange={(event) =>
                                  setFeeDrafts((current) => ({
                                    ...current,
                                    [vendor.vendor_id!]: event.target.value,
                                  }))
                                }
                                style={{ width: "92px" }}
                              />
                              <span className="muted">
                                {vendor.fee_grace_ends_at ? "After grace" : "Base"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>{new Date(vendor.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="admin-table-actions">
                          {vendor.vendor_id ? (
                            <button
                              className="button"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void updateVendorFee(vendor.vendor_id!)}
                            >
                              {activeAction === `fee-${vendor.vendor_id}` ? "Updating..." : "Update fee"}
                            </button>
                          ) : null}
                          {vendor.vendor_id ? (
                            <button
                              className="button-secondary"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() =>
                                void toggleVendor(vendor.vendor_id!, !Boolean(vendor.vendor_active))
                              }
                            >
                              {activeAction === `vendor-${vendor.vendor_id}`
                                ? "Saving..."
                                : vendor.vendor_active
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          ) : null}
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={activeAction !== null}
                            onClick={() => void toggleLogin(vendor.id, !vendor.is_active)}
                          >
                            {activeAction === `user-${vendor.id}`
                              ? "Saving..."
                              : vendor.is_active
                                ? "Disable login"
                                : "Enable login"}
                          </button>
                          {vendor.vendor_id && !vendor.vendor_verified ? (
                            <button
                              className="button-ghost"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void resendVerification(vendor.vendor_id!)}
                            >
                              {activeAction === `verify-${vendor.vendor_id}`
                                ? "Sending..."
                                : "Resend verification"}
                            </button>
                          ) : null}
                          {vendor.vendor_id ? (
                            <Link className="button-ghost" href={`/admin/vendors/${vendor.vendor_id}`}>
                              Open
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </RequireRole>
  );
}
