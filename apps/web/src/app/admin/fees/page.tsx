"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminVendorEconomicsHistoryEntry,
  AdminVendorEconomicsResponse,
  AdminVendorEconomicsRow,
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

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

export default function AdminFeesPage() {
  const { token, currentRole } = useAuth();
  const [rows, setRows] = useState<AdminVendorFeeRow[]>([]);
  const [economics, setEconomics] = useState<AdminVendorEconomicsResponse | null>(null);
  const [economicMonth, setEconomicMonth] = useState(getCurrentMonthKey);
  const [search, setSearch] = useState("");
  const [expandedEconomicsVendorId, setExpandedEconomicsVendorId] = useState<string | null>(null);
  const [expandedPaymentIds, setExpandedPaymentIds] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [historyByVendor, setHistoryByVendor] = useState<
    Record<string, AdminVendorFeeHistoryEntry[]>
  >({});
  const [economicsHistoryByVendor, setEconomicsHistoryByVendor] = useState<
    Record<string, AdminVendorEconomicsHistoryEntry[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [economicsLoading, setEconomicsLoading] = useState(true);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [economicsHistoryLoadingId, setEconomicsHistoryLoadingId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    async function loadEconomics() {
      try {
        setEconomicsLoading(true);
        setError(null);
        const response = await apiRequest<AdminVendorEconomicsResponse>(
          `/admin/vendor-economics?month=${encodeURIComponent(economicMonth)}`,
          undefined,
          token,
        );
        setEconomics(response);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load vendor economic panel.",
        );
      } finally {
        setEconomicsLoading(false);
      }
    }

    void loadEconomics();
  }, [currentRole, economicMonth, token]);

  function togglePayment(vendorId: string, paymentId: string) {
    setExpandedPaymentIds((current) => ({
      ...current,
      [vendorId]: {
        ...(current[vendorId] ?? {}),
        [paymentId]: !(current[vendorId]?.[paymentId] ?? false),
      },
    }));
  }

  async function toggleEconomicsHistory(vendorId: string) {
    if (!token) {
      return;
    }

    if (expandedEconomicsVendorId === vendorId) {
      setExpandedEconomicsVendorId(null);
      return;
    }

    setExpandedEconomicsVendorId(vendorId);

    if (economicsHistoryByVendor[vendorId]) {
      return;
    }

    try {
      setEconomicsHistoryLoadingId(vendorId);
      setHistoryLoadingId(vendorId);
      setError(null);
      const [economicsHistory, feeHistory] = await Promise.all([
        economicsHistoryByVendor[vendorId]
          ? Promise.resolve(economicsHistoryByVendor[vendorId])
          : apiRequest<AdminVendorEconomicsHistoryEntry[]>(
              `/admin/vendor-economics/${vendorId}/history`,
              undefined,
              token,
            ),
        historyByVendor[vendorId]
          ? Promise.resolve(historyByVendor[vendorId])
          : apiRequest<AdminVendorFeeHistoryEntry[]>(
              `/admin/vendor-fees/${vendorId}/history`,
              undefined,
              token,
            ),
      ]);
      setEconomicsHistoryByVendor((current) => ({
        ...current,
        [vendorId]: economicsHistory,
      }));
      setHistoryByVendor((current) => ({
        ...current,
        [vendorId]: feeHistory,
      }));
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Failed to load vendor history.",
      );
    } finally {
      setEconomicsHistoryLoadingId(null);
      setHistoryLoadingId(null);
    }
  }

  const filteredEconomicsRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const nextRows = economics?.rows ?? [];

    const filtered = nextRows.filter((row) =>
      matchesVendorSearch(term, [row.shopName, row.vendorEmail, row.vendorId]),
    );

    return [...filtered].sort((left, right) => {
      const totalDifference = right.totalGrossSales - left.totalGrossSales;

      if (totalDifference !== 0) {
        return totalDifference;
      }

      return left.shopName.localeCompare(right.shopName);
    });
  }, [economics?.rows, search]);

  const feeRowsByVendor = useMemo(
    () => new Map(rows.map((row) => [row.vendorId, row])),
    [rows],
  );

  const economicsTotals = useMemo(
    () =>
      (economics?.rows ?? []).reduce(
        (summary, row) => ({
          cardGrossSales: summary.cardGrossSales + row.cardGrossSales,
          cashOnDeliveryGrossSales:
            summary.cashOnDeliveryGrossSales + row.cashOnDeliveryGrossSales,
          cardFeeCollected: summary.cardFeeCollected + row.cardFeeCollected,
          cashOnDeliveryFeeOwed:
            summary.cashOnDeliveryFeeOwed + row.cashOnDeliveryFeeOwed,
          totalGrossSales: summary.totalGrossSales + row.totalGrossSales,
          totalFee: summary.totalFee + row.totalFee,
          totalOrderCount: summary.totalOrderCount + row.totalOrderCount,
          freeOrderCount: summary.freeOrderCount + row.freeOrderCount,
        }),
        {
          cardGrossSales: 0,
          cashOnDeliveryGrossSales: 0,
          cardFeeCollected: 0,
          cashOnDeliveryFeeOwed: 0,
          totalGrossSales: 0,
          totalFee: 0,
          totalOrderCount: 0,
          freeOrderCount: 0,
        },
      ),
    [economics?.rows],
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
            <section className="form-card stack">
              <div
                className="inline-actions"
                style={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <h2 className="section-title">Monthly economic panel</h2>
                  <p className="muted">
                    Monthly totals reset by the selected month while vendor history remains
                    available below each shop.
                  </p>
                </div>
                <div className="inline-actions" style={{ alignItems: "end" }}>
                  <div className="field" style={{ minWidth: "220px" }}>
                    <label>Search vendors</label>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search shop name or vendor email"
                    />
                  </div>
                  <div className="field" style={{ maxWidth: "180px" }}>
                    <label>Month</label>
                    <input
                      type="month"
                      value={economicMonth}
                      onChange={(event) => setEconomicMonth(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {economicsLoading ? (
                <div className="message">Loading monthly economics...</div>
              ) : (
                <div className="stack">
                  <section className="admin-overview-grid">
                    <div className="form-card admin-overview-card">
                      <span>Clients paid by card</span>
                      <strong>{formatCurrency(economicsTotals.cardGrossSales)}</strong>
                      <p>Vendor gross sales from card orders this month.</p>
                    </div>
                    <div className="form-card admin-overview-card">
                      <span>Clients paid by COD</span>
                      <strong>{formatCurrency(economicsTotals.cashOnDeliveryGrossSales)}</strong>
                      <p>Vendor gross sales from cash-on-delivery orders.</p>
                    </div>
                    <div className="form-card admin-overview-card">
                      <span>Card fees collected</span>
                      <strong>{formatCurrency(economicsTotals.cardFeeCollected)}</strong>
                      <p>Platform fees already taken from online payments.</p>
                    </div>
                    <div className="form-card admin-overview-card">
                      <span>COD fees owed</span>
                      <strong>{formatCurrency(economicsTotals.cashOnDeliveryFeeOwed)}</strong>
                      <p>Platform fees vendors owe from COD orders.</p>
                    </div>
                    <div className="form-card admin-overview-card">
                      <span>Monthly orders</span>
                      <strong>{economicsTotals.totalOrderCount}</strong>
                      <p>Total vendor order groups in {economics?.month ?? economicMonth}.</p>
                    </div>
                    <div className="form-card admin-overview-card">
                      <span>Free-state orders</span>
                      <strong>{economicsTotals.freeOrderCount}</strong>
                      <p>Orders from shops still inside their two-month free period.</p>
                    </div>
                  </section>

                  {filteredEconomicsRows.length === 0 ? (
                    <div className="empty">No vendor economics for this month.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="admin-simple-table">
                        <thead>
                          <tr>
                            <th>Vendor</th>
                            <th>Card paid</th>
                            <th>COD paid</th>
                            <th>COD collected</th>
                            <th>COD pending</th>
                            <th>Card fee paid</th>
                            <th>COD fee owed</th>
                            <th>Total orders</th>
                            <th>Free orders</th>
                            <th>Last order</th>
                            <th>History</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEconomicsRows.map((row: AdminVendorEconomicsRow) => {
                            const isExpanded = expandedEconomicsVendorId === row.vendorId;
                            const history = economicsHistoryByVendor[row.vendorId];
                            const feeRow = feeRowsByVendor.get(row.vendorId);
                            const feeHistory = historyByVendor[row.vendorId];
                            const payments = buildPaymentGroups(feeHistory);
                            const codOwedEntries = buildCodOwedEntries(feeHistory);

                            return (
                              <Fragment key={`economics-${row.vendorId}`}>
                                <tr
                                  className="admin-clickable-row"
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                  onClick={() => void toggleEconomicsHistory(row.vendorId)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      void toggleEconomicsHistory(row.vendorId);
                                    }
                                  }}
                                >
                                  <td>
                                    <div className="admin-table-stack">
                                      <strong>{row.shopName}</strong>
                                      <span className="muted">{row.vendorEmail}</span>
                                    </div>
                                  </td>
                                  <td>{formatCurrency(row.cardGrossSales)}</td>
                                  <td>{formatCurrency(row.cashOnDeliveryGrossSales)}</td>
                                  <td>
                                    {formatCurrency(row.cashOnDeliveryCollectedGrossSales)}
                                  </td>
                                  <td>
                                    {formatCurrency(row.cashOnDeliveryPendingGrossSales)}
                                  </td>
                                  <td>{formatCurrency(row.cardFeeCollected)}</td>
                                  <td>{formatCurrency(row.cashOnDeliveryFeeOwed)}</td>
                                  <td>{row.totalOrderCount}</td>
                                  <td>
                                    {row.freeOrderCount > 0 ? (
                                      <div className="admin-table-stack">
                                        <strong>{row.freeOrderCount}</strong>
                                        <span className="muted">
                                          Free until{" "}
                                          {row.feeGraceEndsAt
                                            ? new Date(row.feeGraceEndsAt).toLocaleDateString()
                                            : "grace ends"}
                                        </span>
                                      </div>
                                    ) : (
                                      0
                                    )}
                                  </td>
                                  <td>
                                    {row.lastOrderAt
                                      ? new Date(row.lastOrderAt).toLocaleDateString()
                                      : "No orders"}
                                  </td>
                                  <td>
                                    <button
                                      className="button-secondary"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void toggleEconomicsHistory(row.vendorId);
                                      }}
                                    >
                                      {isExpanded ? "Hide" : "Monthly history"}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded ? (
                                  <tr>
                                    <td colSpan={11}>
                                      <div className="card stack">
                                        <div className="admin-table-stack">
                                          <strong>{row.shopName} monthly history</strong>
                                          <span className="muted">
                                            Each row is a closed month-style summary kept from
                                            past order records.
                                          </span>
                                        </div>
                                        {economicsHistoryLoadingId === row.vendorId && !history ? (
                                          <div className="message">Loading monthly history...</div>
                                        ) : !history || history.length === 0 ? (
                                          <div className="empty">
                                            No monthly history exists for this vendor yet.
                                          </div>
                                        ) : (
                                          <div className="table-wrap">
                                            <table className="admin-simple-table">
                                              <thead>
                                                <tr>
                                                  <th>Month</th>
                                                  <th>Card paid</th>
                                                  <th>COD paid</th>
                                                  <th>Card fee paid</th>
                                                  <th>COD fee owed</th>
                                                  <th>Orders</th>
                                                  <th>Last order</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {history.map((entry) => (
                                                  <tr key={`${row.vendorId}-${entry.month}`}>
                                                    <td>{entry.month}</td>
                                                    <td>{formatCurrency(entry.cardGrossSales)}</td>
                                                    <td>
                                                      {formatCurrency(
                                                        entry.cashOnDeliveryGrossSales,
                                                      )}
                                                    </td>
                                                    <td>{formatCurrency(entry.cardFeeCollected)}</td>
                                                    <td>
                                                      {formatCurrency(
                                                        entry.cashOnDeliveryFeeOwed,
                                                      )}
                                                    </td>
                                                    <td>{entry.totalOrderCount}</td>
                                                    <td>
                                                      {entry.lastOrderAt
                                                        ? new Date(
                                                            entry.lastOrderAt,
                                                          ).toLocaleDateString()
                                                        : "No orders"}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}

                                        <div className="stack">
                                          <div className="admin-table-stack">
                                            <strong>Fee payment history</strong>
                                            <span className="muted">
                                              Online card fees are already collected. COD fees stay
                                              visible here until they are settled.
                                            </span>
                                          </div>

                                          {historyLoadingId === row.vendorId && !feeHistory ? (
                                            <div className="message">Loading fee history...</div>
                                          ) : (
                                            <div className="stack">
                                              <div className="mini-stats">
                                                <div className="mini-stat">
                                                  <span>Fee method</span>
                                                  <strong>Dynamic</strong>
                                                </div>
                                                <div className="mini-stat">
                                                  <span>Online fee collected</span>
                                                  <strong>
                                                    {formatCurrency(
                                                      feeRow?.onlineFeeCollected ?? 0,
                                                    )}
                                                  </strong>
                                                </div>
                                                <div className="mini-stat">
                                                  <span>COD fee owed</span>
                                                  <strong>
                                                    {formatCurrency(
                                                      feeRow?.cashOnDeliveryFeeOwed ?? 0,
                                                    )}
                                                  </strong>
                                                </div>
                                                <div className="mini-stat">
                                                  <span>Fee orders</span>
                                                  <strong>{feeRow?.chargedOrderCount ?? 0}</strong>
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
                                                          expandedPaymentIds[row.vendorId]?.[
                                                            payment.id
                                                          ],
                                                        );

                                                        return (
                                                          <Fragment key={payment.id}>
                                                            <tr>
                                                              <td>
                                                                {new Date(
                                                                  payment.paidDate,
                                                                ).toLocaleDateString()}
                                                              </td>
                                                              <td>
                                                                {formatCurrency(payment.paidAmount)}
                                                              </td>
                                                              <td>{payment.ordersCovered}</td>
                                                              <td>
                                                                {formatCurrency(
                                                                  payment.totalPlatformTake,
                                                                )}
                                                              </td>
                                                              <td>
                                                                <button
                                                                  className="button-ghost"
                                                                  type="button"
                                                                  onClick={() =>
                                                                    togglePayment(
                                                                      row.vendorId,
                                                                      payment.id,
                                                                    )
                                                                  }
                                                                >
                                                                  {isPaymentExpanded
                                                                    ? "Hide orders"
                                                                    : "Show orders"}
                                                                </button>
                                                              </td>
                                                            </tr>
                                                            {isPaymentExpanded ? (
                                                              <tr>
                                                                <td colSpan={5}>
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
                                                                            <td>
                                                                              {formatCurrency(
                                                                                entry.paidAmount,
                                                                              )}
                                                                            </td>
                                                                            <td>
                                                                              {formatCurrency(
                                                                                entry.grossSales,
                                                                              )}
                                                                            </td>
                                                                            <td>
                                                                              {entry.paymentMethod} /{" "}
                                                                              {entry.paymentStatus}
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

                                              {codOwedEntries.length === 0 ? (
                                                <div className="empty">
                                                  No COD fee is currently owed by this vendor.
                                                </div>
                                              ) : (
                                                <div className="table-wrap">
                                                  <table className="admin-simple-table">
                                                    <thead>
                                                      <tr>
                                                        <th>COD order</th>
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
                                                            {entry.paymentMethod} /{" "}
                                                            {entry.paymentStatus}
                                                          </td>
                                                          <td>
                                                            {new Date(entry.paidAt).toLocaleString()}
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          )}
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
                </div>
              )}
            </section>

          </>

        )}
      </div>
    </RequireRole>
  );
}
