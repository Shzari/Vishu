"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminVendorFeeHistoryEntry,
  AdminVendorFeeRow,
} from "@/lib/types";

interface VendorFeePaymentGroup {
  id: string;
  paidDate: string;
  paidAmount: number;
  totalPlatformTake: number;
  ordersCovered: number;
  entries: AdminVendorFeeHistoryEntry[];
}

function buildCodOwedEntries(
  history: AdminVendorFeeHistoryEntry[] | undefined,
): AdminVendorFeeHistoryEntry[] {
  return (history ?? [])
    .filter((entry) => entry.owedAmount > 0)
    .sort((left, right) => right.paidAt.localeCompare(left.paidAt));
}

function buildPaymentGroups(
  history: AdminVendorFeeHistoryEntry[] | undefined,
): VendorFeePaymentGroup[] {
  const paymentGroups = new Map<string, VendorFeePaymentGroup>();

  for (const entry of history ?? []) {
    if (entry.paidAmount <= 0) {
      continue;
    }

    const paidDate = entry.paidAt.slice(0, 10);
    const existing = paymentGroups.get(paidDate);

    if (existing) {
      existing.paidAmount += entry.paidAmount;
      existing.totalPlatformTake += entry.totalPlatformTake;
      existing.ordersCovered += 1;
      existing.entries.push(entry);
      continue;
    }

    paymentGroups.set(paidDate, {
      id: paidDate,
      paidDate,
      paidAmount: entry.paidAmount,
      totalPlatformTake: entry.totalPlatformTake,
      ordersCovered: 1,
      entries: [entry],
    });
  }

  return [...paymentGroups.values()].sort((left, right) =>
    right.paidDate.localeCompare(left.paidDate),
  );
}

export default function AdminFeesPage() {
  const { token, currentRole } = useAuth();
  const [rows, setRows] = useState<AdminVendorFeeRow[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<
    "onlineFeeCollected" | "cashOnDeliveryFeeOwed" | "totalFeeGenerated"
  >("cashOnDeliveryFeeOwed");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);
  const [expandedPaymentIds, setExpandedPaymentIds] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [historyByVendor, setHistoryByVendor] = useState<
    Record<string, AdminVendorFeeHistoryEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadFees() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiRequest<AdminVendorFeeRow[]>(
          "/admin/vendor-fees",
          undefined,
          token,
        );
        setRows(response);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load vendor fees.");
      } finally {
        setLoading(false);
      }
    }

    void loadFees();
  }, [currentRole, token]);

  async function toggleHistory(vendorId: string) {
    if (!token) {
      return;
    }

    if (expandedVendorId === vendorId) {
      setExpandedVendorId(null);
      return;
    }

    setExpandedVendorId(vendorId);

    if (historyByVendor[vendorId]) {
      return;
    }

    try {
      setHistoryLoadingId(vendorId);
      setError(null);
      const response = await apiRequest<AdminVendorFeeHistoryEntry[]>(
        `/admin/vendor-fees/${vendorId}/history`,
        undefined,
        token,
      );
      setHistoryByVendor((current) => ({
        ...current,
        [vendorId]: response,
      }));
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Failed to load vendor fee history.",
      );
    } finally {
      setHistoryLoadingId(null);
    }
  }

  function togglePayment(vendorId: string, paymentId: string) {
    setExpandedPaymentIds((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] ?? {}),
        [paymentId]: !(current[vendorId]?.[paymentId] ?? false),
      },
    }));
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nextRows = !term
      ? [...rows]
      : rows.filter((row) =>
          `${row.shopName} ${row.vendorEmail}`.toLowerCase().includes(term),
        );

    nextRows.sort((left, right) => {
      const value =
        Number(left[sortField] ?? 0) - Number(right[sortField] ?? 0);

      if (value !== 0) {
        return sortDirection === "asc" ? value : -value;
      }

      return left.shopName.localeCompare(right.shopName);
    });

    return nextRows;
  }, [rows, search, sortDirection, sortField]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (summary, row) => ({
          totalFeeGenerated: summary.totalFeeGenerated + row.totalFeeGenerated,
          onlineFeeCollected:
            summary.onlineFeeCollected + row.onlineFeeCollected,
          cashOnDeliveryFeeOwed:
            summary.cashOnDeliveryFeeOwed + row.cashOnDeliveryFeeOwed,
          outstandingFee: summary.outstandingFee + row.outstandingFee,
          totalPlatformTake: summary.totalPlatformTake + row.totalPlatformTake,
          vendorsWithFees:
            summary.vendorsWithFees + (row.totalFeeGenerated > 0 ? 1 : 0),
        }),
        {
          totalFeeGenerated: 0,
          onlineFeeCollected: 0,
          cashOnDeliveryFeeOwed: 0,
          outstandingFee: 0,
          totalPlatformTake: 0,
          vendorsWithFees: 0,
        },
      ),
    [rows],
  );

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Vendor finance</span>
            <h1 className="admin-page-title">Vendor Fees</h1>
            <p className="admin-page-description">
              Track what each vendor owes, what has already been collected, and the payment
              history for vendor fees. Expand a payment batch to see which orders were covered
              by that payment.
            </p>
          </div>
        </section>

        {error ? <div className="message error">{error}</div> : null}

        {loading ? (
          <div className="message">Loading vendor fees...</div>
        ) : (
          <>
            <section className="admin-overview-grid">
              <div className="form-card admin-overview-card">
                <span>Total fee generated</span>
                <strong>{formatCurrency(totals.totalFeeGenerated)}</strong>
                <p>Total fixed vendor fees generated across all orders.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Online fee collected</span>
                <strong>{formatCurrency(totals.onlineFeeCollected)}</strong>
                <p>Fee already taken immediately from online payments.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>COD fee owed</span>
                <strong>{formatCurrency(totals.cashOnDeliveryFeeOwed)}</strong>
                <p>Cash-on-delivery fee amounts vendors still owe.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Platform take</span>
                <strong>{formatCurrency(totals.totalPlatformTake)}</strong>
                <p>Percentage commission plus fixed vendor fee.</p>
              </div>
              <div className="form-card admin-overview-card">
                <span>Vendors with fee activity</span>
                <strong>{totals.vendorsWithFees}</strong>
                <p>Shops with either collected online fees or COD fees still owed.</p>
              </div>
            </section>

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
                  <label>Sort by price</label>
                  <select
                    value={sortField}
                    onChange={(event) =>
                      setSortField(
                        event.target.value as
                          | "onlineFeeCollected"
                          | "cashOnDeliveryFeeOwed"
                          | "totalFeeGenerated",
                      )
                    }
                  >
                    <option value="cashOnDeliveryFeeOwed">COD fee owed</option>
                    <option value="onlineFeeCollected">Online fee collected</option>
                    <option value="totalFeeGenerated">Total fee generated</option>
                  </select>
                </div>
                <div className="field">
                  <label>Direction</label>
                  <select
                    value={sortDirection}
                    onChange={(event) =>
                      setSortDirection(event.target.value as "asc" | "desc")
                    }
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="form-card stack">
              <div>
                <h2 className="section-title">Vendor fee ledger</h2>
                <p className="muted">
                  Sorted by{" "}
                  {sortField === "cashOnDeliveryFeeOwed"
                    ? "COD fee owed"
                    : sortField === "onlineFeeCollected"
                      ? "online fee collected"
                      : "total fee generated"}{" "}
                  in {sortDirection === "asc" ? "ascending" : "descending"} order.
                </p>
              </div>

              {filteredRows.length === 0 ? (
                <div className="empty">No vendor fee records match the current search.</div>
              ) : (
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Current fee</th>
                        <th>Online fee collected</th>
                        <th>COD fee owed</th>
                        <th>Total fee generated</th>
                        <th>Last payment date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const isExpanded = expandedVendorId === row.vendorId;
                        const history = historyByVendor[row.vendorId];
                        const payments = buildPaymentGroups(history);
                        const codOwedEntries = buildCodOwedEntries(history);

                        return (
                          <Fragment key={row.vendorId}>
                            <tr>
                              <td>
                                <div className="admin-table-stack">
                                  <strong>{row.shopName}</strong>
                                  <span className="muted">{row.vendorEmail}</span>
                                </div>
                              </td>
                              <td>
                                <div className="admin-table-stack">
                                  <strong>{formatCurrency(row.effectivePlatformFee)}</strong>
                                  {row.feeGraceEndsAt ? (
                                    <span className="muted">
                                      Free until {new Date(row.feeGraceEndsAt).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span className="muted">
                                      Base {formatCurrency(row.basePlatformFee)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{formatCurrency(row.onlineFeeCollected)}</td>
                              <td>{formatCurrency(row.cashOnDeliveryFeeOwed)}</td>
                              <td>{formatCurrency(row.totalFeeGenerated)}</td>
                              <td>
                                {row.lastPaidAt
                                  ? new Date(row.lastPaidAt).toLocaleDateString()
                                  : "No payment yet"}
                              </td>
                              <td>
                                <div className="admin-table-actions">
                                  <button
                                    className="button-secondary"
                                    type="button"
                                    onClick={() => void toggleHistory(row.vendorId)}
                                  >
                                    {isExpanded ? "Hide payments" : "View payments"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr>
                                <td colSpan={7}>
                                  <div className="card stack">
                                    <div
                                      className="inline-actions"
                                      style={{
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                    >
                                      <div className="admin-table-stack">
                                        <strong>{row.shopName} payment history</strong>
                                        <span className="muted">
                                          Online fees are shown as collected payment batches.
                                          COD orders are listed separately as amounts still owed.
                                        </span>
                                      </div>
                                      <span className="chip">{row.chargedOrderCount} fee orders</span>
                                    </div>

                                    {historyLoadingId === row.vendorId && !history ? (
                                      <div className="message">Loading payment history...</div>
                                    ) : (
                                      <div className="stack">
                                        <div className="mini-stats">
                                          <div className="mini-stat">
                                            <span>Online fee collected</span>
                                            <strong>{formatCurrency(row.onlineFeeCollected)}</strong>
                                          </div>
                                          <div className="mini-stat">
                                            <span>COD fee owed</span>
                                            <strong>{formatCurrency(row.cashOnDeliveryFeeOwed)}</strong>
                                          </div>
                                          <div className="mini-stat">
                                            <span>Online orders</span>
                                            <strong>{row.onlineCollectedOrderCount}</strong>
                                          </div>
                                          <div className="mini-stat">
                                            <span>COD orders owing fee</span>
                                            <strong>{row.cashOnDeliveryOwedOrderCount}</strong>
                                          </div>
                                        </div>

                                        {payments.length === 0 ? (
                                          <div className="empty">
                                            No online fee collections yet for this vendor.
                                          </div>
                                        ) : (
                                          <div className="table-wrap">
                                            <table className="admin-simple-table">
                                              <thead>
                                                <tr>
                                                  <th>Online payment date</th>
                                                  <th>Fee collected</th>
                                                  <th>Orders covered</th>
                                                  <th>Platform take</th>
                                                  <th>Action</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {payments.map((payment) => {
                                                  const isPaymentExpanded = Boolean(
                                                    expandedPaymentIds[row.vendorId]?.[payment.id],
                                                  );

                                                  return (
                                                    <Fragment key={payment.id}>
                                                      <tr>
                                                        <td>
                                                          {new Date(payment.paidDate).toLocaleDateString()}
                                                        </td>
                                                        <td>{formatCurrency(payment.paidAmount)}</td>
                                                        <td>{payment.ordersCovered}</td>
                                                        <td>{formatCurrency(payment.totalPlatformTake)}</td>
                                                        <td>
                                                          <button
                                                            className="button-ghost"
                                                            type="button"
                                                            onClick={() =>
                                                              togglePayment(row.vendorId, payment.id)
                                                            }
                                                          >
                                                            {isPaymentExpanded
                                                              ? "Hide covered orders"
                                                              : "Show covered orders"}
                                                          </button>
                                                        </td>
                                                      </tr>
                                                      {isPaymentExpanded ? (
                                                        <tr>
                                                          <td colSpan={5}>
                                                            <div className="card stack">
                                                              <div className="admin-table-stack">
                                                                <strong>
                                                                  Orders covered by the online payment on{" "}
                                                                  {new Date(
                                                                    payment.paidDate,
                                                                  ).toLocaleDateString()}
                                                                </strong>
                                                                <span className="muted">
                                                                  These online-paid orders already gave
                                                                  you the platform fee immediately.
                                                                </span>
                                                              </div>
                                                              <div className="table-wrap">
                                                                <table className="admin-simple-table">
                                                                  <thead>
                                                                    <tr>
                                                                      <th>Order</th>
                                                                      <th>Fee collected</th>
                                                                      <th>Gross sales</th>
                                                                      <th>Status</th>
                                                                      <th>Created</th>
                                                                    </tr>
                                                                  </thead>
                                                                  <tbody>
                                                                    {payment.entries.map((entry) => (
                                                                      <tr key={entry.orderId}>
                                                                        <td>{entry.orderNumber}</td>
                                                                        <td>{formatCurrency(entry.paidAmount)}</td>
                                                                        <td>{formatCurrency(entry.grossSales)}</td>
                                                                        <td>
                                                                          <div className="admin-table-stack">
                                                                            <span className="chip">
                                                                              {entry.orderStatus}
                                                                            </span>
                                                                            <span className="muted">
                                                                              {entry.paymentMethod} /{" "}
                                                                              {entry.paymentStatus}
                                                                            </span>
                                                                          </div>
                                                                        </td>
                                                                        <td>
                                                                          {new Date(
                                                                            entry.paidAt,
                                                                          ).toLocaleString()}
                                                                        </td>
                                                                      </tr>
                                                                    ))}
                                                                  </tbody>
                                                                </table>
                                                              </div>
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

                                        <div className="card stack">
                                          <div className="admin-table-stack">
                                            <strong>Cash on delivery fees still owed</strong>
                                            <span className="muted">
                                              These orders used cash on delivery, so the vendor still
                                              owes the platform fee.
                                            </span>
                                          </div>

                                          {codOwedEntries.length === 0 ? (
                                            <div className="empty">
                                              No COD fee is currently owed by this vendor.
                                            </div>
                                          ) : (
                                            <div className="table-wrap">
                                              <table className="admin-simple-table">
                                                <thead>
                                                  <tr>
                                                    <th>Order</th>
                                                    <th>Fee owed</th>
                                                    <th>Gross sales</th>
                                                    <th>Payment</th>
                                                    <th>Created</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {codOwedEntries.map((entry) => (
                                                    <tr key={`${entry.orderId}-owed`}>
                                                      <td>{entry.orderNumber}</td>
                                                      <td>{formatCurrency(entry.owedAmount)}</td>
                                                      <td>{formatCurrency(entry.grossSales)}</td>
                                                      <td>
                                                        <div className="admin-table-stack">
                                                          <span className="chip">{entry.paymentStatus}</span>
                                                          <span className="muted">{entry.paymentMethod}</span>
                                                        </div>
                                                      </td>
                                                      <td>{new Date(entry.paidAt).toLocaleString()}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </div>
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
