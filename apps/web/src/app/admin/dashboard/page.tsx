"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminCatalogRequest,
  AdminOverview,
  AdminReportingSnapshot,
} from "@/lib/types";

export default function AdminDashboardPage() {
  const { token, currentRole } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reporting, setReporting] = useState<AdminReportingSnapshot | null>(null);
  const [pendingRequests, setPendingRequests] = useState<AdminCatalogRequest[]>(
    [],
  );
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        const [nextOverview, nextReporting, nextRequests] = await Promise.all([
          apiRequest<AdminOverview>("/admin/overview", undefined, token),
          apiRequest<AdminReportingSnapshot>(
            `/admin/reporting?rangeDays=${rangeDays}`,
            undefined,
            token,
          ),
          apiRequest<AdminCatalogRequest[]>(
            "/admin/catalog-requests?status=pending",
            undefined,
            token,
          ),
        ]);
        setOverview(nextOverview);
        setReporting(nextReporting);
        setPendingRequests(nextRequests);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load admin dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [currentRole, rangeDays, token]);

  const unreadNotifications = useMemo(
    () => overview?.notifications.filter((entry) => !entry.readAt) ?? [],
    [overview],
  );

  const recentVendorSignups = useMemo(
    () =>
      overview?.recentUsers.filter((entry) => entry.role === "vendor").slice(0, 5) ??
      [],
    [overview],
  );

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <h1 className="admin-page-title">Admin dashboard</h1>
          </div>
          <div className="admin-page-actions">
            <Link className="button-secondary" href="/admin/requests">
              Review requests
            </Link>
            <Link className="button" href="/admin/vendors">
              Open vendors
            </Link>
          </div>
        </section>

        {error ? <div className="message error">{error}</div> : null}
        {loading || !overview || !reporting ? (
          <div className="message">Loading admin workspace...</div>
        ) : (
          <>
            <section className="admin-overview-grid">
              <div className="form-card admin-overview-card">
                <span>Pending approvals</span>
                <strong>{overview.totals.pendingVendorApprovals}</strong>
                <p>Verified vendors waiting for activation.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Requests waiting</span>
                <strong>{pendingRequests.length}</strong>
                <p>Structured catalog requests pending review.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Total revenue</span>
                <strong>{formatCurrency(overview.commerce.grossRevenue)}</strong>
                <p>Marketplace gross revenue across all completed selling activity.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Active vendors</span>
                <strong>{overview.totals.activeVendors}</strong>
                <p>Shops currently visible and active on the marketplace.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>New vendors</span>
                <strong>{reporting.newVendors}</strong>
                <p>Vendor signups in the selected reporting window.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Unread alerts</span>
                <strong>{overview.totals.unreadNotifications}</strong>
                <p>Admin notifications and platform notices waiting to be read.</p>
              </div>
            </section>

            <section className="admin-section-grid">
              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                  <h2 className="section-title">Vendor approvals</h2>
                  <Link className="button-secondary" href="/admin/vendors">
                    View all vendors
                  </Link>
                </div>
                {overview.pendingVendors.length === 0 ? (
                  <div className="empty">No vendors are waiting for approval right now.</div>
                ) : (
                  <div className="admin-list">
                    {overview.pendingVendors.slice(0, 5).map((vendor) => (
                      <div key={vendor.id} className="admin-list-row">
                        <div className="admin-list-copy">
                          <strong>{vendor.shopName}</strong>
                          <p className="muted">{vendor.email}</p>
                          <p className="muted">
                            Waiting since {new Date(vendor.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="admin-table-actions">
                          <Link className="button-secondary" href={`/admin/vendors/${vendor.id}`}>
                            Review
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                  <h2 className="section-title">Request queue</h2>
                  <Link className="button-secondary" href="/admin/requests">
                    Open requests
                  </Link>
                </div>
                {pendingRequests.length === 0 ? (
                  <div className="empty">No pending catalog requests.</div>
                ) : (
                  <div className="admin-list">
                    {pendingRequests.slice(0, 5).map((request) => (
                      <div key={request.id} className="admin-list-row">
                        <div className="admin-list-copy">
                          <strong>{request.requestedValue}</strong>
                          <p className="muted">
                            {request.requestType} request from {request.vendor.shopName}
                          </p>
                          <p className="muted">
                            {request.categoryName ? `${request.categoryName} · ` : ""}
                            {request.subcategoryName ? `${request.subcategoryName} · ` : ""}
                            {request.sizeTypeName ? `${request.sizeTypeName} · ` : ""}
                            {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="admin-status-pill pending">Pending</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </section>

            <section className="admin-section-grid">
              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                  <h2 className="section-title">Revenue and growth</h2>
                  <div className="chip-row">
                    {[7, 30, 90].map((days) => (
                      <button
                        key={days}
                        className={rangeDays === days ? "button" : "button-secondary"}
                        type="button"
                        onClick={() => setRangeDays(days as 7 | 30 | 90)}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>{formatCurrency(reporting.revenue)}</strong>
                    <span className="muted">Revenue in window</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{reporting.orderCount}</strong>
                    <span className="muted">Orders in window</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{formatCurrency(reporting.averageOrderValue)}</strong>
                    <span className="muted">Average order value</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{reporting.newCustomers}</strong>
                    <span className="muted">New customers</span>
                  </div>
                </div>
                <div className="admin-section-grid">
                  <div className="card stack">
                    <strong>{reporting.topShop?.shopName ?? "No top vendor yet"}</strong>
                    <p className="muted">
                      {reporting.topShop
                        ? `${formatCurrency(reporting.topShop.grossRevenue)} across ${reporting.topShop.orderCount} orders`
                        : "Sales data will appear here once orders start flowing through the marketplace."}
                    </p>
                  </div>
                  <div className="card stack">
                    <strong>{reporting.topCategory?.category ?? "No top category yet"}</strong>
                    <p className="muted">
                      {reporting.topCategory
                        ? `${reporting.topCategory.unitsSold} units sold · ${formatCurrency(reporting.topCategory.grossRevenue)}`
                        : "Category momentum will appear here after enough sales are recorded."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                  <h2 className="section-title">Alerts and signups</h2>
                  <Link className="button-secondary" href="/admin/reports">
                    Open reports
                  </Link>
                </div>
                <div className="admin-list">
                  {(unreadNotifications.length ? unreadNotifications : overview.notifications.slice(0, 4)).map(
                    (notification) => (
                      <div key={notification.id} className="admin-list-row">
                        <div className="admin-list-copy">
                          <strong>{notification.title}</strong>
                          <p className="muted">{notification.body}</p>
                          <p className="muted">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="admin-status-pill pending">
                          {notification.readAt ? "Read" : "Unread"}
                        </span>
                      </div>
                    ),
                  )}
                  {recentVendorSignups.map((entry) => (
                    <div key={entry.id} className="admin-list-row">
                      <div className="admin-list-copy">
                        <strong>{entry.email}</strong>
                        <p className="muted">Recent vendor signup</p>
                        <p className="muted">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="admin-status-pill active">New</span>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <h2 className="section-title">Recent admin activity</h2>
                <Link className="button-secondary" href="/admin/settings">
                  Open settings
                </Link>
              </div>
              {overview.activities.length === 0 ? (
                <div className="empty">No admin activity recorded yet.</div>
              ) : (
                <div className="admin-list">
                  {overview.activities.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="admin-list-row">
                      <div className="admin-list-copy">
                        <strong>{activity.description}</strong>
                        <p className="muted">
                          {activity.adminEmail} · {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="chip">{activity.entityType}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </RequireRole>
  );
}
