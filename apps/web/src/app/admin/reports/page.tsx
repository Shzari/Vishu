"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminOverview,
  AdminReportingSnapshot,
  AdminVendorDetail,
  AdminVendorOrderActivity,
  AdminVendorPayoutRow,
} from "@/lib/types";

const VENDOR_ORDER_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

export default function AdminReportsPage() {
  const { token, currentRole } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reporting, setReporting] = useState<AdminReportingSnapshot | null>(null);
  const [payouts, setPayouts] = useState<AdminVendorPayoutRow[]>([]);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [expandedVendorDetails, setExpandedVendorDetails] = useState<
    Record<string, AdminVendorDetail>
  >({});
  const [expandedVendorOrders, setExpandedVendorOrders] = useState<
    Record<string, AdminVendorOrderActivity[]>
  >({});
  const [vendorOrderFilters, setVendorOrderFilters] = useState<Record<string, string>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [ordersLoadingId, setOrdersLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadReports() {
      try {
        setLoading(true);
        setError(null);
        const [nextOverview, nextReporting, nextPayouts] = await Promise.all([
          apiRequest<AdminOverview>("/admin/overview", undefined, token),
          apiRequest<AdminReportingSnapshot>(
            `/admin/reporting?rangeDays=${rangeDays}`,
            undefined,
            token,
          ),
          apiRequest<AdminVendorPayoutRow[]>("/admin/payouts", undefined, token),
        ]);
        setOverview(nextOverview);
        setReporting(nextReporting);
        setPayouts(nextPayouts);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load reports.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadReports();
  }, [currentRole, rangeDays, token]);

  async function loadVendorOrders(vendorId: string, status: string) {
    if (!token) {
      return;
    }

    try {
      setOrdersLoadingId(vendorId);
      setError(null);
      const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const orders = await apiRequest<AdminVendorOrderActivity[]>(
        `/admin/vendors/${vendorId}/orders${query}`,
        undefined,
        token,
      );
      setExpandedVendorOrders((current) => ({
        ...current,
        [vendorId]: orders,
      }));
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? orderError.message
          : "Failed to load vendor order history.",
      );
    } finally {
      setOrdersLoadingId(null);
    }
  }

  async function toggleVendorDetail(vendorId: string) {
    if (!token) {
      return;
    }

    if (expandedVendorId === vendorId) {
      setExpandedVendorId(null);
      return;
    }

    setExpandedVendorId(vendorId);

    const selectedStatus = vendorOrderFilters[vendorId] ?? "all";
    if (expandedVendorDetails[vendorId] && expandedVendorOrders[vendorId]) {
      return;
    }

    try {
      setError(null);
      const work: Promise<unknown>[] = [];

      if (!expandedVendorDetails[vendorId]) {
        setDetailLoadingId(vendorId);
        work.push(
          apiRequest<AdminVendorDetail>(`/admin/vendors/${vendorId}`, undefined, token).then(
            (detail) => {
              setExpandedVendorDetails((current) => ({
                ...current,
                [vendorId]: detail,
              }));
            },
          ),
        );
      }

      if (!expandedVendorOrders[vendorId]) {
        setOrdersLoadingId(vendorId);
        const query =
          selectedStatus === "all" ? "" : `?status=${encodeURIComponent(selectedStatus)}`;
        work.push(
          apiRequest<AdminVendorOrderActivity[]>(
            `/admin/vendors/${vendorId}/orders${query}`,
            undefined,
            token,
          ).then((orders) => {
            setExpandedVendorOrders((current) => ({
              ...current,
              [vendorId]: orders,
            }));
          }),
        );
      }

      await Promise.all(work);
    } catch (detailError) {
      setError(
        detailError instanceof Error
          ? detailError.message
          : "Failed to load vendor order detail.",
      );
    } finally {
      setDetailLoadingId(null);
      setOrdersLoadingId(null);
    }
  }

  async function handleVendorOrderFilterChange(vendorId: string, nextStatus: string) {
    setVendorOrderFilters((current) => ({
      ...current,
      [vendorId]: nextStatus,
    }));
    await loadVendorOrders(vendorId, nextStatus);
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Marketplace analytics</span>
            <h1 className="admin-page-title">Reports</h1>
            <p className="admin-page-description">
              Review revenue, growth, vendor performance, and payout activity from one
              marketplace-level reporting view.
            </p>
          </div>
          <div className="admin-page-actions">
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
        </section>

        {error ? <div className="message error">{error}</div> : null}
        {loading || !overview || !reporting ? (
          <div className="message">Loading reports...</div>
        ) : (
          <>
            <section className="admin-overview-grid">
              <div className="form-card admin-overview-card">
                <span>Revenue</span>
                <strong>{formatCurrency(reporting.revenue)}</strong>
                <p>Revenue in the selected reporting window.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Orders</span>
                <strong>{reporting.orderCount}</strong>
                <p>Marketplace orders in the selected window.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Average order value</span>
                <strong>{formatCurrency(reporting.averageOrderValue)}</strong>
                <p>Average spend per order across the selected range.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>New customers</span>
                <strong>{reporting.newCustomers}</strong>
                <p>Customer growth in the selected range.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>New vendors</span>
                <strong>{reporting.newVendors}</strong>
                <p>Vendor growth in the selected range.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Total commission</span>
                <strong>{formatCurrency(overview.commerce.totalCommission)}</strong>
                <p>Platform commission accumulated across all orders.</p>
              </div>
            </section>

            <section className="admin-section-grid">
              <section className="form-card stack">
                <div>
                  <h2 className="section-title">Performance highlights</h2>
                  <p className="muted">
                    Watch marketplace growth, top-performing vendors, and category momentum.
                  </p>
                </div>
                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>{formatCurrency(overview.commerce.grossRevenue)}</strong>
                    <span className="muted">Lifetime revenue</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{overview.totals.totalOrders}</strong>
                    <span className="muted">Lifetime orders</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{overview.totals.totalCustomers}</strong>
                    <span className="muted">Customers</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{overview.totals.totalVendors}</strong>
                    <span className="muted">Vendors</span>
                  </div>
                </div>
                <div className="admin-section-grid">
                  <div className="card stack">
                    <strong>{reporting.topShop?.shopName ?? "No vendor data yet"}</strong>
                    <p className="muted">
                      {reporting.topShop
                        ? `${formatCurrency(reporting.topShop.grossRevenue)} across ${reporting.topShop.orderCount} orders`
                        : "The top vendor will appear here once order history is available."}
                    </p>
                    {reporting.topShop ? (
                      <Link
                        className="button-secondary"
                        href={`/admin/vendors/${reporting.topShop.vendorId}`}
                      >
                        Open vendor
                      </Link>
                    ) : null}
                  </div>
                  <div className="card stack">
                    <strong>{reporting.topCategory?.category ?? "No category data yet"}</strong>
                    <p className="muted">
                      {reporting.topCategory
                        ? `${reporting.topCategory.unitsSold} units sold - ${formatCurrency(reporting.topCategory.grossRevenue)}`
                        : "The top category will appear here once products generate enough orders."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="form-card stack">
                <div>
                  <h2 className="section-title">Vendor payout visibility</h2>
                  <p className="muted">
                    Track what is payable, already paid, and still outstanding across vendors.
                  </p>
                </div>
                <div className="mini-stats">
                  <div className="mini-stat">
                    <strong>
                      {formatCurrency(payouts.reduce((sum, row) => sum + row.payableNow, 0))}
                    </strong>
                    <span className="muted">Payable now</span>
                  </div>
                  <div className="mini-stat">
                    <strong>
                      {formatCurrency(payouts.reduce((sum, row) => sum + row.paidOut, 0))}
                    </strong>
                    <span className="muted">Paid out</span>
                  </div>
                  <div className="mini-stat">
                    <strong>
                      {formatCurrency(
                        payouts.reduce((sum, row) => sum + row.outstandingShippedBalance, 0),
                      )}
                    </strong>
                    <span className="muted">Outstanding shipped balance</span>
                  </div>
                </div>
              </section>
            </section>

            <section className="form-card stack">
              <div>
                <h2 className="section-title">Vendor performance table</h2>
                <p className="muted">
                  Revenue and payout visibility by shop with current payable balance.
                </p>
              </div>
              {payouts.length === 0 ? (
                <div className="empty">No payout data available yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Gross sales</th>
                        <th>Commission</th>
                        <th>Payable now</th>
                        <th>Paid out</th>
                        <th>Outstanding</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((row) => {
                        const isExpanded = expandedVendorId === row.vendorId;
                        const detail = expandedVendorDetails[row.vendorId];
                        const orders = expandedVendorOrders[row.vendorId];
                        const activeStatusFilter = vendorOrderFilters[row.vendorId] ?? "all";

                        return (
                          <Fragment key={row.vendorId}>
                            <tr>
                              <td>
                                <div className="admin-table-stack">
                                  <strong>{row.shopName}</strong>
                                  <span className="muted">{row.vendorEmail}</span>
                                </div>
                              </td>
                              <td>{formatCurrency(row.grossSales)}</td>
                              <td>{formatCurrency(row.totalCommission)}</td>
                              <td>{formatCurrency(row.payableNow)}</td>
                              <td>{formatCurrency(row.paidOut)}</td>
                              <td>{formatCurrency(row.outstandingShippedBalance)}</td>
                              <td>
                                <div className="admin-table-actions">
                                  <button
                                    className="button-secondary"
                                    type="button"
                                    onClick={() => void toggleVendorDetail(row.vendorId)}
                                  >
                                    {isExpanded ? "Hide orders" : "View orders"}
                                  </button>
                                  <Link
                                    className="button-ghost"
                                    href={`/admin/vendors/${row.vendorId}`}
                                  >
                                    Open
                                  </Link>
                                  <Link
                                    className="button-ghost"
                                    href={`/admin/vendors/${row.vendorId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    New window
                                  </Link>
                                </div>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr>
                                <td colSpan={7}>
                                  <div className="card stack">
                                    {detailLoadingId === row.vendorId && !detail ? (
                                      <div className="message">Loading vendor orders...</div>
                                    ) : !detail ? (
                                      <div className="empty">
                                        Vendor details are not available yet.
                                      </div>
                                    ) : (
                                      <>
                                        <div
                                          className="inline-actions"
                                          style={{
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                          }}
                                        >
                                          <div>
                                            <strong>{detail.shopName}</strong>
                                            <p className="muted">
                                              Full vendor order history with a quick status
                                              filter and direct links back to each order.
                                            </p>
                                          </div>
                                          <Link
                                            className="button-secondary"
                                            href={`/admin/vendors/${detail.id}`}
                                          >
                                            Open full vendor detail
                                          </Link>
                                        </div>

                                        <div className="mini-stats">
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
                                            <strong>
                                              {formatCurrency(detail.metrics.totalEarnings)}
                                            </strong>
                                            <span className="muted">Vendor earnings</span>
                                          </div>
                                        </div>

                                        <div
                                          className="inline-actions"
                                          style={{
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                          }}
                                        >
                                          <div className="admin-table-stack">
                                            <strong>Order history</strong>
                                            <span className="muted">
                                              Filter line items by their current fulfillment
                                              state.
                                            </span>
                                          </div>
                                          <label className="field" style={{ minWidth: 180 }}>
                                            <span>Status</span>
                                            <select
                                              value={activeStatusFilter}
                                              onChange={(event) =>
                                                void handleVendorOrderFilterChange(
                                                  row.vendorId,
                                                  event.target.value,
                                                )
                                              }
                                            >
                                              {VENDOR_ORDER_STATUS_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                  {option.label}
                                                </option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>

                                        {ordersLoadingId === row.vendorId && !orders ? (
                                          <div className="message">
                                            Loading vendor order history...
                                          </div>
                                        ) : !orders || orders.length === 0 ? (
                                          <div className="empty">
                                            No vendor orders match this filter yet.
                                          </div>
                                        ) : (
                                          <div className="admin-list">
                                            {orders.map((item) => (
                                              <div
                                                key={`${item.orderId}-${item.createdAt}`}
                                                className="admin-list-row"
                                              >
                                                <div className="admin-list-copy">
                                                  <strong>{item.orderNumber}</strong>
                                                  <p className="muted">{item.customerEmail}</p>
                                                  <p className="muted">
                                                    {item.productCode
                                                      ? `${item.productCode} - `
                                                      : ""}
                                                    {item.productTitle}
                                                  </p>
                                                  <p className="muted">
                                                    Qty {item.quantity} -{" "}
                                                    {new Date(item.createdAt).toLocaleString()}
                                                  </p>
                                                  {item.shipment?.trackingNumber ? (
                                                    <p className="muted">
                                                      {item.shipment.shippingCarrier ||
                                                        "Carrier pending"}{" "}
                                                      - {item.shipment.trackingNumber}
                                                    </p>
                                                  ) : null}
                                                </div>
                                                <div className="admin-table-actions">
                                                  <span className="chip">{item.status}</span>
                                                  <span className="chip">
                                                    {formatCurrency(item.vendorEarnings)}
                                                  </span>
                                                  <Link
                                                    className="button-ghost"
                                                    href={`/admin/orders/${item.orderId}`}
                                                  >
                                                    Open order
                                                  </Link>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </RequireRole>
  );
}
