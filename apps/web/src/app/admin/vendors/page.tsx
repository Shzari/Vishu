"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type { AdminUserRow } from "@/lib/types";

function matchesVendorSearch(search: string, values: Array<string | null | undefined>) {
  const terms = search
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function formatActivityDate(value?: string | null) {
  if (!value) return "No activity";
  return new Date(value).toLocaleDateString();
}

export default function AdminVendorsPage() {
  const { token, currentRole } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
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

  async function toggleVendorProducts(vendorId: string, isListed: boolean) {
    if (!token) return;

    try {
      setActiveAction(`vendor-products-${vendorId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{
        message: string;
        totalProducts: number;
        listedProducts: number;
        hiddenProducts: number;
      }>(
        `/admin/vendors/${vendorId}/products-visibility`,
        { method: "PATCH", body: JSON.stringify({ isListed }) },
        token,
      );
      setMessage(
        `${response.message} ${response.listedProducts}/${response.totalProducts} products visible.`,
      );
      await loadVendors();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update vendor products.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteVendor(vendorId: string, shopName?: string | null) {
    if (!token) return;

    const vendorLabel = shopName?.trim() || "this vendor";
    if (
      !window.confirm(
        `Delete ${vendorLabel}? This permanently removes the vendor, products, payout records, and any orders connected to this vendor.`,
      )
    ) {
      return;
    }

    const adminPassword = window.prompt("Enter your admin password to confirm deletion.");
    if (!adminPassword) {
      return;
    }

    try {
      setActiveAction(`delete-${vendorId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/vendors/${vendorId}`,
        {
          method: "DELETE",
          body: JSON.stringify({ adminPassword }),
        },
        token,
      );
      setMessage(response.message);
      await loadVendors();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete vendor.");
    } finally {
      setActiveAction(null);
    }
  }

  async function verifyVendorManually(vendorId: string) {
    if (!token) return;

    try {
      setActiveAction(`manual-verify-${vendorId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/vendors/${vendorId}/verify`,
        { method: "POST" },
        token,
      );
      setMessage(response.message);
      await loadVendors();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to verify vendor.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleVendorOtpBypass(vendorId: string, isBypassed: boolean) {
    if (!token) return;

    try {
      setActiveAction(`otp-bypass-${vendorId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/admin/vendors/${vendorId}/otp-bypass`,
        { method: "PATCH", body: JSON.stringify({ isBypassed }) },
        token,
      );
      setMessage(response.message);
      await loadVendors();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update vendor OTP bypass.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const vendors = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users
      .filter((entry) => entry.vendor_id)
      .filter((entry) => {
        const matchesSearch = matchesVendorSearch(term, [
          entry.shop_name,
          entry.email,
          entry.phone_number,
          entry.vendor_id,
        ]);
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
                placeholder="Search shop name or vendor email"
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
                    <th>Last activity</th>
                    <th>Fee</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => {
                    const productCount = Number(vendor.vendor_product_count ?? 0);
                    const listedProductCount = Number(vendor.vendor_listed_product_count ?? 0);
                    const shouldShowProducts =
                      productCount > 0 && listedProductCount === 0;

                    return (
                    <tr key={vendor.id}>
                      <td>
                        <div className="admin-table-stack">
                          <strong>{vendor.shop_name ?? "Unnamed shop"}</strong>
                          <span className="muted">{vendor.email}</span>
                          <span className="muted">
                            {vendor.support_phone || vendor.phone_number
                              ? `Mobile: ${vendor.support_phone || vendor.phone_number}`
                              : "No mobile number saved"}
                          </span>
                          {vendor.vendor_id ? (
                            <span className="muted">
                              {listedProductCount}/{productCount} products visible
                            </span>
                          ) : null}
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
                        {vendor.vendor_login_otp_bypassed ? (
                          <span className="muted">OTP bypass</span>
                        ) : null}
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
                        <div className="admin-table-stack">
                          <strong>{formatActivityDate(vendor.last_activity_at)}</strong>
                          {vendor.inactivity_disabled_at ? (
                            <span className="muted">
                              Disabled {formatActivityDate(vendor.inactivity_disabled_at)}
                            </span>
                          ) : vendor.reactivation_requested_at ? (
                            <span className="muted">
                              Reactivation {formatActivityDate(vendor.reactivation_requested_at)}
                            </span>
                          ) : vendor.last_login_at ? (
                            <span className="muted">
                              Login {formatActivityDate(vendor.last_login_at)}
                            </span>
                          ) : (
                            <span className="muted">No login yet</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {vendor.vendor_id ? (
                          <div className="admin-table-stack">
                            <strong>
                              {vendor.platform_fee_mode === "fixed"
                                ? `${formatCurrency(Number(vendor.platform_fee ?? 0))} fixed`
                                : "Dynamic"}
                            </strong>
                            {vendor.fee_free_until || vendor.fee_grace_ends_at ? (
                              <span className="muted">
                                Free until{" "}
                                {new Date(
                                  vendor.fee_free_until ?? vendor.fee_grace_ends_at!,
                                ).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="muted">Per accepted subtotal</span>
                            )}
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
                          {vendor.vendor_id && !vendor.vendor_verified ? (
                            <button
                              className="button-ghost"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void verifyVendorManually(vendor.vendor_id!)}
                            >
                              {activeAction === `manual-verify-${vendor.vendor_id}`
                                ? "Saving..."
                                : "Verify"}
                            </button>
                          ) : null}
                          {vendor.vendor_id ? (
                            <button
                              className="button-ghost"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() =>
                                void toggleVendorOtpBypass(
                                  vendor.vendor_id!,
                                  !Boolean(vendor.vendor_login_otp_bypassed),
                                )
                              }
                            >
                              {activeAction === `otp-bypass-${vendor.vendor_id}`
                                ? "Saving..."
                                : vendor.vendor_login_otp_bypassed
                                  ? "Require OTP"
                                  : "Bypass OTP"}
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
                            <button
                              className="button-ghost"
                              type="button"
                              disabled={activeAction !== null || productCount === 0}
                              onClick={() =>
                                void toggleVendorProducts(
                                  vendor.vendor_id!,
                                  shouldShowProducts,
                                )
                              }
                            >
                              {activeAction === `vendor-products-${vendor.vendor_id}`
                                ? "Saving..."
                                : shouldShowProducts
                                  ? "Show products"
                                  : "Hide products"}
                            </button>
                          ) : null}
                          {vendor.vendor_id ? (
                            <Link className="button-ghost" href={`/admin/vendors/${vendor.vendor_id}`}>
                              Open
                            </Link>
                          ) : null}
                          {vendor.vendor_id ? (
                            <button
                              className="danger-button"
                              type="button"
                              disabled={activeAction !== null}
                              onClick={() => void deleteVendor(vendor.vendor_id!, vendor.shop_name)}
                            >
                              {activeAction === `delete-${vendor.vendor_id}` ? "Deleting..." : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </RequireRole>
  );
}
