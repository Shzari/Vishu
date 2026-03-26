"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminOverview,
  AdminReportingSnapshot,
  AdminVendorPayoutRow,
} from "@/lib/types";

export default function AdminReportsPage() {
  const { token, currentRole } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [reporting, setReporting] = useState<AdminReportingSnapshot | null>(null);
  const [payouts, setPayouts] = useState<AdminVendorPayoutRow[]>([]);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
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
                      <Link className="button-secondary" href={`/admin/vendors/${reporting.topShop.vendorId}`}>
                        Open vendor
                      </Link>
                    ) : null}
                  </div>
                  <div className="card stack">
                    <strong>{reporting.topCategory?.category ?? "No category data yet"}</strong>
                    <p className="muted">
                      {reporting.topCategory
                        ? `${reporting.topCategory.unitsSold} units sold · ${formatCurrency(reporting.topCategory.grossRevenue)}`
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
                    <strong>{formatCurrency(payouts.reduce((sum, row) => sum + row.payableNow, 0))}</strong>
                    <span className="muted">Payable now</span>
                  </div>
                  <div className="mini-stat">
                    <strong>{formatCurrency(payouts.reduce((sum, row) => sum + row.paidOut, 0))}</strong>
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
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((row) => (
                        <tr key={row.vendorId}>
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
                        </tr>
                      ))}
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
