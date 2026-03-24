"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { StatusBadge } from "@/components/status-badge";
import { apiRequest, formatCurrency } from "@/lib/api";
import type { AdminOrderRow, AdminOverview, AdminReportingSnapshot, AdminUserRow, AdminVendorPayoutRow } from "@/lib/types";

type AdminView = "dashboard" | "vendors" | "customers" | "orders" | "shipping" | "payouts";

const adminViews: { id: AdminView; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "vendors", label: "Vendors" },
  { id: "customers", label: "Customers" },
  { id: "orders", label: "Orders" },
  { id: "shipping", label: "Shipping" },
  { id: "payouts", label: "Payouts" },
];

const vendorFilterOptions = ["all", "pending", "active", "inactive", "loginDisabled"] as const;
const customerFilterOptions = ["all", "active", "disabled"] as const;
const orderFilterOptions = ["all", "pending", "confirmed", "shipped", "delivered"] as const;
const shippingFilterOptions = ["all", "shipped", "delivered"] as const;
const reportingRangeOptions = [7, 30, 90] as const;

function readOption<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}

function readView(value: string | null): AdminView {
  return readOption(
    value,
    adminViews.map((entry) => entry.id),
    "dashboard",
  );
}

function readRangeDays(value: string | null): 7 | 30 | 90 {
  const parsed = Number(value);
  return reportingRangeOptions.includes(parsed as 7 | 30 | 90) ? (parsed as 7 | 30 | 90) : 30;
}

function paymentLabel(order: Pick<AdminOrderRow, "paymentMethod" | "paymentStatus">) {
  const method = order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online";
  const status =
    order.paymentStatus === "cod_pending"
      ? "Pending collection"
      : order.paymentStatus === "cod_collected"
        ? "Cash collected"
        : order.paymentStatus === "cod_refused"
          ? "Delivery refused"
          : "Paid";
  return `${method} | ${status}`;
}

export default function AdminDashboardPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [payouts, setPayouts] = useState<AdminVendorPayoutRow[]>([]);
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [reportRangeDays, setReportRangeDays] = useState<7 | 30 | 90>(30);
  const [reportingSnapshot, setReportingSnapshot] = useState<AdminReportingSnapshot | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState<(typeof vendorFilterOptions)[number]>("all");
  const [customerFilter, setCustomerFilter] = useState<(typeof customerFilterOptions)[number]>("all");
  const [orderFilter, setOrderFilter] = useState<(typeof orderFilterOptions)[number]>("all");
  const [shippingFilter, setShippingFilter] = useState<(typeof shippingFilterOptions)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutDraftVendorId, setPayoutDraftVendorId] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const applyUrlState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveView(readView(params.get("view")));
      setReportRangeDays(readRangeDays(params.get("rangeDays")));
      setAccountSearch(params.get("accountSearch") ?? "");
      setOrderSearch(params.get("orderSearch") ?? "");
      setVendorFilter(readOption(params.get("vendorFilter"), vendorFilterOptions, "all"));
      setCustomerFilter(readOption(params.get("customerFilter"), customerFilterOptions, "all"));
      setOrderFilter(readOption(params.get("orderFilter"), orderFilterOptions, "all"));
      setShippingFilter(readOption(params.get("shippingFilter"), shippingFilterOptions, "all"));
    };

    applyUrlState();
    window.addEventListener("popstate", applyUrlState);
    return () => window.removeEventListener("popstate", applyUrlState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    params.set("view", activeView);
    params.set("rangeDays", String(reportRangeDays));

    if (accountSearch.trim()) {
      params.set("accountSearch", accountSearch.trim());
    } else {
      params.delete("accountSearch");
    }

    if (orderSearch.trim()) {
      params.set("orderSearch", orderSearch.trim());
    } else {
      params.delete("orderSearch");
    }

    if (vendorFilter === "all") {
      params.delete("vendorFilter");
    } else {
      params.set("vendorFilter", vendorFilter);
    }

    if (customerFilter === "all") {
      params.delete("customerFilter");
    } else {
      params.set("customerFilter", customerFilter);
    }

    if (orderFilter === "all") {
      params.delete("orderFilter");
    } else {
      params.set("orderFilter", orderFilter);
    }

    if (shippingFilter === "all") {
      params.delete("shippingFilter");
    } else {
      params.set("shippingFilter", shippingFilter);
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [
    activeView,
    accountSearch,
    customerFilter,
    orderFilter,
    orderSearch,
    reportRangeDays,
    shippingFilter,
    vendorFilter,
  ]);

  async function loadAdminData() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [nextOverview, nextUsers, nextOrders, nextPayouts] = await Promise.all([
        apiRequest<AdminOverview>("/admin/overview", undefined, token),
        apiRequest<AdminUserRow[]>("/admin/users", undefined, token),
        apiRequest<AdminOrderRow[]>("/admin/orders", undefined, token),
        apiRequest<AdminVendorPayoutRow[]>("/admin/payouts", undefined, token),
      ]);
      setOverview(nextOverview);
      setUsers(nextUsers);
      setOrders(nextOrders);
      setPayouts(nextPayouts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReportingSnapshot(rangeDays: 7 | 30 | 90) {
    if (!token) return;
    try {
      const nextSnapshot = await apiRequest<AdminReportingSnapshot>(`/admin/reporting?rangeDays=${rangeDays}`, undefined, token);
      setReportingSnapshot(nextSnapshot);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reporting snapshot.");
    }
  }

  useEffect(() => {
    if (token && user?.role === "admin") void loadAdminData();
  }, [token, user]);

  useEffect(() => {
    if (token && user?.role === "admin") void loadReportingSnapshot(reportRangeDays);
  }, [token, user, reportRangeDays]);

  async function toggleUser(userId: string, isActive: boolean) {
    if (!token) return;
    try {
      setActiveAction(`user-${userId}`);
      await apiRequest(`/admin/users/${userId}/activation`, { method: "PATCH", body: JSON.stringify({ isActive }) }, token);
      setMessage("User status updated.");
      await loadAdminData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update user.");
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleVendor(vendorId: string, isActive: boolean) {
    if (!token) return;
    try {
      setActiveAction(`vendor-${vendorId}`);
      await apiRequest(`/admin/vendors/${vendorId}/activation`, { method: "PATCH", body: JSON.stringify({ isActive }) }, token);
      setMessage("Vendor activation updated.");
      await loadAdminData();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update vendor.");
    } finally {
      setActiveAction(null);
    }
  }

  async function resendVendorVerification(vendorId: string) {
    if (!token) return;
    try {
      setActiveAction(`verify-${vendorId}`);
      const response = await apiRequest<{ message: string }>(
        `/admin/vendors/${vendorId}/verification-resend`,
        { method: "POST" },
        token,
      );
      setMessage(response.message);
      await loadAdminData();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to resend verification email.");
    } finally {
      setActiveAction(null);
    }
  }

  async function triggerReset(userId: string) {
    if (!token) return;
    try {
      setActiveAction(`reset-${userId}`);
      const response = await apiRequest<{ message: string }>(`/admin/users/${userId}/password-reset`, { method: "POST" }, token);
      setMessage(response.message);
      await loadAdminData();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to trigger reset.");
    } finally {
      setActiveAction(null);
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!token) return;
    try {
      setActiveAction(`notification-${notificationId}`);
      await apiRequest(`/admin/notifications/${notificationId}/read`, { method: "PATCH" }, token);
      setMessage("Notification marked as read.");
      await loadAdminData();
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "Unable to update notification.");
    } finally {
      setActiveAction(null);
    }
  }

  async function downloadExport(resource: "vendors" | "customers" | "orders") {
    if (!token) return;
    try {
      setActiveAction(`export-${resource}`);
      const response = await apiRequest<{ filename: string; csv: string }>(`/admin/exports/${resource}`, undefined, token);
      const blob = new Blob([response.csv], { type: "text/csv;charset=utf-8;" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = response.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setMessage(`${resource[0].toUpperCase()}${resource.slice(1)} export downloaded.`);
      await loadAdminData();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to generate export.");
    } finally {
      setActiveAction(null);
    }
  }

  async function recordPayout(vendorId: string) {
    if (!token) return;

    try {
      setActiveAction(`payout-${vendorId}`);
      setError(null);
      setMessage(null);
      await apiRequest(
        "/admin/payouts",
        {
          method: "POST",
          body: JSON.stringify({
            vendorId,
            amount: Number(payoutAmount),
            reference: payoutReference.trim() || undefined,
            note: payoutNote.trim() || undefined,
          }),
        },
        token,
      );
      setMessage("Vendor payout recorded.");
      setPayoutDraftVendorId(null);
      setPayoutAmount("");
      setPayoutReference("");
      setPayoutNote("");
      await loadAdminData();
    } catch (payoutError) {
      setError(payoutError instanceof Error ? payoutError.message : "Unable to record payout.");
    } finally {
      setActiveAction(null);
    }
  }

  const vendorUsers = useMemo(() => {
    const term = accountSearch.trim().toLowerCase();
    return users.filter((entry) => {
      if (!entry.vendor_id) return false;
      const matchesSearch = !term || `${entry.email} ${entry.shop_name ?? ""}`.toLowerCase().includes(term);
      const matchesFilter =
        vendorFilter === "all" ||
        (vendorFilter === "pending" && !entry.vendor_active) ||
        (vendorFilter === "active" && Boolean(entry.vendor_active)) ||
        (vendorFilter === "inactive" && !entry.vendor_active) ||
        (vendorFilter === "loginDisabled" && !entry.is_active);
      return matchesSearch && matchesFilter;
    });
  }, [accountSearch, users, vendorFilter]);

  const customerUsers = useMemo(() => {
    const term = accountSearch.trim().toLowerCase();
    return users.filter(
      (entry) =>
        entry.role === "customer" &&
        (!term || entry.email.toLowerCase().includes(term)) &&
        (customerFilter === "all" ||
          (customerFilter === "active" && entry.is_active) ||
          (customerFilter === "disabled" && !entry.is_active)),
    );
  }, [accountSearch, users, customerFilter]);

  const filteredOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = orderFilter === "all" || order.status === orderFilter;
      const matchesSearch = !term || `${order.id} ${order.customerEmail}`.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [orderFilter, orderSearch, orders]);

  const shippingOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = shippingFilter === "all" || order.status === shippingFilter;
      const matchesSearch = !term || `${order.id} ${order.customerEmail}`.toLowerCase().includes(term);
      return (order.status === "shipped" || order.status === "delivered") && matchesFilter && matchesSearch;
    });
  }, [orderSearch, orders, shippingFilter]);

  const cancelRequestedOrders = useMemo(() => orders.filter((order) => order.cancelRequest?.status === "requested"), [orders]);
  const attentionOrders = useMemo(() => [...orders].filter((order) => order.cancelRequest?.status === "requested" || order.status === "pending" || order.status === "confirmed").sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))).slice(0, 6), [orders]);
  const shippingAttentionOrders = useMemo(() => [...orders].filter((order) => order.status === "shipped").sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))).slice(0, 4), [orders]);
  const purchasedUnits = useMemo(() => orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0), [orders]);
  const trackedShipments = useMemo(() => orders.reduce((sum, order) => sum + order.items.filter((item) => item.shipment?.trackingNumber).length, 0), [orders]);
  const payoutReadyVendors = useMemo(() => payouts.filter((entry) => entry.outstandingShippedBalance > 0), [payouts]);
  const payoutOutstandingTotal = useMemo(() => payouts.reduce((sum, entry) => sum + entry.outstandingShippedBalance, 0), [payouts]);
  const payoutPaidTotal = useMemo(() => payouts.reduce((sum, entry) => sum + entry.paidOut, 0), [payouts]);
  const displayedTopShop = reportingSnapshot?.topShop ?? overview?.reporting.topShop ?? null;
  const displayedTopCategory = reportingSnapshot?.topCategory ?? overview?.reporting.topCategory ?? null;
  const displayedTopCategorySummary = displayedTopCategory
    ? `${displayedTopCategory.unitsSold} units sold | ${formatCurrency(displayedTopCategory.grossRevenue)}`
    : "No sold category data yet.";

  function openView(view: AdminView) { setActiveView(view); }
  function openVendorQueue(filter: (typeof vendorFilterOptions)[number]) { setAccountSearch(""); setVendorFilter(filter); setActiveView("vendors"); }
  function openCustomerQueue(filter: (typeof customerFilterOptions)[number]) { setAccountSearch(""); setCustomerFilter(filter); setActiveView("customers"); }
  function openOrderQueue(filter: (typeof orderFilterOptions)[number] = "all") { setOrderSearch(""); setOrderFilter(filter); setActiveView("orders"); }
  function openShippingQueue(filter: (typeof shippingFilterOptions)[number] = "all") { setOrderSearch(""); setShippingFilter(filter); setActiveView("shipping"); }
  function openPayouts() { setActiveView("payouts"); }

  return <RequireRole requiredRole="admin"><div className="stack">
    <section className="form-card stack">
      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div><h1 className="section-title">{adminViews.find((entry) => entry.id === activeView)?.label ?? "Dashboard"}</h1><p className="muted">Choose a category instead of reading one long admin page.</p></div>
        <button className="button-ghost" type="button" onClick={() => void loadAdminData()}>Refresh</button>
      </div>
      <div className="inline-actions">{adminViews.map((view) => <button key={view.id} className={activeView === view.id ? "button" : "button-secondary"} type="button" onClick={() => openView(view.id)}>{view.label}</button>)}</div>
    </section>
    {message && <div className="message success">{message}</div>}
    {error && <div className="message error">{error}</div>}
    {loading && <div className="message">Refreshing admin data...</div>}

    {overview && activeView === "dashboard" && <>
      <section className="mini-stats">
        <div className="mini-stat"><strong>{overview.totals.totalVendors}</strong><span className="muted">Vendors</span></div>
        <div className="mini-stat"><strong>{overview.totals.subscribedVendors}</strong><span className="muted">Subscribed vendors</span></div>
        <div className="mini-stat"><strong>{overview.totals.totalCustomers}</strong><span className="muted">Customers</span></div>
        <div className="mini-stat"><strong>{overview.totals.totalOrders}</strong><span className="muted">Orders</span></div>
        <div className="mini-stat"><strong>{purchasedUnits}</strong><span className="muted">Purchased units</span></div>
        <div className="mini-stat"><strong>{overview.commerce.shippedOrders}</strong><span className="muted">Shipped</span></div>
        <div className="mini-stat"><strong>{overview.commerce.deliveredOrders}</strong><span className="muted">Delivered</span></div>
        <div className="mini-stat"><strong>{cancelRequestedOrders.length}</strong><span className="muted">Cancel requests</span></div>
        <div className="mini-stat"><strong>{overview.totals.unreadNotifications}</strong><span className="muted">Unread notices</span></div>
        <div className="mini-stat"><strong>{overview.totals.subscriptionsExpiringSoon}</strong><span className="muted">Subscriptions expiring soon</span></div>
        <div className="mini-stat"><strong>{formatCurrency(overview.commerce.grossRevenue)}</strong><span className="muted">Revenue</span></div>
        <div className="mini-stat"><strong>{formatCurrency(payoutOutstandingTotal)}</strong><span className="muted">Delivered unpaid</span></div>
      </section>
      <section className="split">
        <div className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="section-title">Reporting Snapshot</h2>
              <p className="muted">Use this to read platform momentum before you open the detailed queues.</p>
            </div>
            <div className="chip-row">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  className={reportRangeDays === days ? "button" : "button-secondary"}
                  type="button"
                  onClick={() => setReportRangeDays(days as 7 | 30 | 90)}
                >
                  {days} days
                </button>
              ))}
            </div>
          </div>
          <div className="order-summary-grid">
            <div className="mini-stat">
              <strong>{formatCurrency(reportingSnapshot?.averageOrderValue ?? overview.reporting.averageOrderValue)}</strong>
              <span className="muted">Average order value</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(reportingSnapshot?.revenue ?? overview.reporting.revenueLast30Days)}</strong>
              <span className="muted">Revenue in window</span>
            </div>
            <div className="mini-stat">
              <strong>{reportingSnapshot?.orderCount ?? overview.totals.totalOrders}</strong>
              <span className="muted">Orders in window</span>
            </div>
            <div className="mini-stat">
              <strong>{reportingSnapshot?.newUsers ?? overview.reporting.newUsersLast7Days}</strong>
              <span className="muted">New users in window</span>
            </div>
            <div className="mini-stat">
              <strong>{reportingSnapshot?.newCustomers ?? overview.reporting.newCustomersLast7Days}</strong>
              <span className="muted">New customers in window</span>
            </div>
            <div className="mini-stat">
              <strong>{reportingSnapshot?.newVendors ?? overview.reporting.newVendorsLast7Days}</strong>
              <span className="muted">New vendors in window</span>
            </div>
          </div>
        </div>
        <div className="form-card stack">
          <div>
            <h2 className="section-title">Top Performers</h2>
            <p className="muted">Spot which shop and product category are carrying the marketplace right now.</p>
          </div>
          <div className="order-summary-grid">
            <div className="card">
              <strong>{displayedTopShop?.shopName ?? "No shop data yet"}</strong>
              <p className="muted">
                {displayedTopShop
                  ? `${formatCurrency(displayedTopShop.grossRevenue)} across ${displayedTopShop.orderCount} orders`
                  : "No completed sales data yet."}
              </p>
              {displayedTopShop ? (
                <Link className="button-secondary" href={`/admin/vendors/${displayedTopShop.vendorId}`}>
                  Open top shop
                </Link>
              ) : null}
            </div>
            <div className="card">
              <strong>{reportingSnapshot?.topCategory?.category ?? overview.reporting.topCategory?.category ?? "No category data yet"}</strong>
              <p className="muted">
                {displayedTopCategory
                  ? `${displayedTopCategory.unitsSold} units sold | ${formatCurrency(displayedTopCategory.grossRevenue)}`
                  : "No sold category data yet."}
              </p>
              {displayedTopCategory ? <p className="muted">Selected window: {displayedTopCategorySummary}</p> : null}
            </div>
          </div>
        </div>
      </section>
      <section className="form-card stack">
        <div>
          <h2 className="section-title">Exports</h2>
          <p className="muted">Download clean CSV summaries for vendor ops, customer accounts, and marketplace orders.</p>
        </div>
        <div className="inline-actions">
          <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void downloadExport("vendors")}>
            {activeAction === "export-vendors" ? "Preparing vendor export..." : "Export vendors"}
          </button>
          <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void downloadExport("customers")}>
            {activeAction === "export-customers" ? "Preparing customer export..." : "Export customers"}
          </button>
          <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void downloadExport("orders")}>
            {activeAction === "export-orders" ? "Preparing order export..." : "Export orders"}
          </button>
        </div>
      </section>
      <section className="split">
        <div className="form-card stack"><h2 className="section-title">Quick Queues</h2><div className="order-summary-grid">
          <div className="mini-stat"><strong>{overview.totals.pendingVendorApprovals}</strong><span className="muted">Pending approvals</span></div>
          <div className="mini-stat"><strong>{overview.commerce.pendingOrders + overview.commerce.confirmedOrders}</strong><span className="muted">Waiting fulfillment</span></div>
          <div className="mini-stat"><strong>{trackedShipments}</strong><span className="muted">Tracked shipments</span></div>
          <div className="mini-stat"><strong>{cancelRequestedOrders.length}</strong><span className="muted">Customer cancel requests</span></div>
        </div><div className="inline-actions">
          <button className="button-secondary" type="button" onClick={() => openVendorQueue("pending")}>Open approval queue</button>
          <button className="button-secondary" type="button" onClick={() => openOrderQueue()}>Open orders</button>
          <button className="button-secondary" type="button" onClick={() => openShippingQueue()}>Open shipping</button>
          <button className="button-secondary" type="button" onClick={() => openPayouts()}>Open payouts</button>
        </div></div>
        <div className="form-card stack"><h2 className="section-title">Notifications</h2>
          {overview.notifications.length ? overview.notifications.slice(0, 4).map((notification) => <div key={notification.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><strong>{notification.title}</strong><p className="muted">{new Date(notification.createdAt).toLocaleString()}</p><p className="muted">{notification.body}</p></div>
            <div className="chip-row"><span className={notification.readAt ? "badge" : "badge warn"}>{notification.readAt ? "Read" : "Unread"}</span>{notification.actionUrl ? <Link className="button-ghost" href={notification.actionUrl}>Open</Link> : null}{!notification.readAt ? <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void markNotificationRead(notification.id)}>{activeAction === `notification-${notification.id}` ? "Saving..." : "Mark read"}</button> : null}</div>
          </div></div>) : <div className="empty">No admin notifications yet.</div>}
        </div>
      </section>
      <section className="split">
        <div className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Approval Queue</h2><p className="muted">Verified vendors waiting for activation should be handled first.</p></div><button className="button-secondary" type="button" onClick={() => openVendorQueue("pending")}>Open vendor queue</button></div>
          {overview.pendingVendors.length ? overview.pendingVendors.slice(0, 5).map((vendor) => <div key={vendor.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><strong>{vendor.shopName}</strong><p className="muted">{vendor.email}</p><p className="muted">Verified vendor waiting since {new Date(vendor.createdAt).toLocaleDateString()}</p></div>
            <div className="stack-actions">{!vendorUsers.find((entry) => entry.vendor_id === vendor.id)?.vendor_verified ? <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void resendVendorVerification(vendor.id)}>{activeAction === `verify-${vendor.id}` ? "Sending..." : "Verify"}</button> : null}<button className="button" type="button" disabled={activeAction !== null} onClick={() => void toggleVendor(vendor.id, true)}>{activeAction === `vendor-${vendor.id}` ? "Saving..." : "Activate now"}</button><Link className="button-secondary" href={`/admin/vendors/${vendor.id}`}>Review</Link></div>
          </div></div>) : <div className="empty">No vendors are waiting for approval right now.</div>}
        </div>
        <div className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Order Attention</h2><p className="muted">Surface cancel requests and unfulfilled orders before they get buried.</p></div><button className="button-secondary" type="button" onClick={() => openOrderQueue()}>Open order queue</button></div>
          {attentionOrders.length ? attentionOrders.map((order) => <div key={order.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><strong>Order {order.id}</strong><p className="muted">{order.customerEmail}</p><p className="muted">{new Date(order.createdAt).toLocaleString()}</p><div className="chip-row"><StatusBadge status={order.status} />{order.cancelRequest?.status === "requested" ? <span className="badge warn">Cancel requested</span> : null}</div></div>
            <Link className="button-secondary" href={`/admin/orders/${order.id}`}>Open order</Link>
          </div></div>) : <div className="empty">No urgent order attention items right now.</div>}
        </div>
      </section>
    </>}

    {overview && activeView === "dashboard" && <section className="split">
      <div className="form-card stack"><div><h2 className="section-title">Shipping Watch</h2><p className="muted">Keep an eye on shipped orders that still need delivery follow-through.</p></div>
        {shippingAttentionOrders.length ? shippingAttentionOrders.map((order) => <div key={order.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><strong>Order {order.id}</strong><p className="muted">{order.customerEmail}</p><p className="muted">{paymentLabel(order)}</p></div>
          <div className="chip-row"><span className="chip">{order.items.filter((item) => item.shipment?.trackingNumber).length} tracked</span><Link className="button-secondary" href={`/admin/orders/${order.id}`}>Open</Link></div>
        </div></div>) : <div className="empty">No shipped orders need follow-up right now.</div>}
      </div>
      <div className="form-card stack"><div><h2 className="section-title">Account Watch</h2><p className="muted">Jump straight into the account queues that need admin attention.</p></div><div className="order-summary-grid">
        <button className="mini-stat queue-stat-button" type="button" onClick={() => openVendorQueue("loginDisabled")}><strong>{users.filter((entry) => entry.vendor_id && !entry.is_active).length}</strong><span className="muted">Vendor logins disabled</span></button>
        <button className="mini-stat queue-stat-button" type="button" onClick={() => openCustomerQueue("disabled")}><strong>{users.filter((entry) => entry.role === "customer" && !entry.is_active).length}</strong><span className="muted">Customer logins disabled</span></button>
        <button className="mini-stat queue-stat-button" type="button" onClick={() => openVendorQueue("active")}><strong>{users.filter((entry) => entry.vendor_active).length}</strong><span className="muted">Active vendors</span></button>
        <button className="mini-stat queue-stat-button" type="button" onClick={() => openCustomerQueue("active")}><strong>{users.filter((entry) => entry.role === "customer" && entry.is_active).length}</strong><span className="muted">Active customers</span></button>
      </div></div>
    </section>}

    {overview && activeView === "dashboard" && <section className="split">
      <div className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Payout Watch</h2><p className="muted">See which vendors have delivered balances ready for payout and whether bank details are complete.</p></div><button className="button-secondary" type="button" onClick={() => openPayouts()}>Open payouts</button></div>
        <div className="order-summary-grid">
          <div className="mini-stat"><strong>{payoutReadyVendors.length}</strong><span className="muted">Vendors ready</span></div>
          <div className="mini-stat"><strong>{formatCurrency(payoutOutstandingTotal)}</strong><span className="muted">Outstanding total</span></div>
          <div className="mini-stat"><strong>{formatCurrency(payoutPaidTotal)}</strong><span className="muted">Paid out total</span></div>
          <div className="mini-stat"><strong>{payouts.filter((entry) => !entry.bankReady).length}</strong><span className="muted">Missing bank setup</span></div>
        </div>
      </div>
    </section>}

    {overview && activeView === "dashboard" && <section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Recent Admin Activity</h2><p className="muted">See the latest platform actions like approvals, account changes, resets, and settings edits.</p></div><Link className="button-secondary" href="/admin/settings">Open admin settings</Link></div>
      {overview.activities.length ? <div className="stack">{overview.activities.map((entry) => <div key={entry.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><strong>{entry.description}</strong><p className="muted">{entry.adminEmail} | {new Date(entry.createdAt).toLocaleString()}</p>{entry.entityLabel ? <p className="muted">{entry.entityType}: {entry.entityLabel}</p> : null}</div><span className="chip">{entry.actionType}</span>
      </div></div>)}</div> : <div className="empty">No admin activity yet.</div>}
    </section>}

    {overview && activeView === "vendors" && <><section className="mini-stats">
      <div className="mini-stat"><strong>{overview.totals.totalVendors}</strong><span className="muted">Total vendors</span></div>
      <div className="mini-stat"><strong>{overview.totals.activeVendors}</strong><span className="muted">Active vendors</span></div>
      <div className="mini-stat"><strong>{overview.totals.pendingVendorApprovals}</strong><span className="muted">Pending queue</span></div>
      <div className="mini-stat"><strong>{vendorUsers.length}</strong><span className="muted">Visible in list</span></div>
    </section><section className="form-card stack">
      <div className="toolbar"><div className="field"><label>Search vendors</label><input placeholder="Shop name or vendor email" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div></div>
      <div className="chip-row"><button className={vendorFilter === "all" ? "button" : "button-secondary"} type="button" onClick={() => setVendorFilter("all")}>All vendors</button><button className={vendorFilter === "pending" ? "button" : "button-secondary"} type="button" onClick={() => setVendorFilter("pending")}>Pending approval</button><button className={vendorFilter === "active" ? "button" : "button-secondary"} type="button" onClick={() => setVendorFilter("active")}>Active</button><button className={vendorFilter === "inactive" ? "button" : "button-secondary"} type="button" onClick={() => setVendorFilter("inactive")}>Inactive</button><button className={vendorFilter === "loginDisabled" ? "button" : "button-secondary"} type="button" onClick={() => setVendorFilter("loginDisabled")}>Login disabled</button></div>
      {overview.pendingVendors.length ? <div className="stack"><h2 className="section-title">Pending Vendor Queue</h2>{overview.pendingVendors.map((vendor) => <div key={vendor.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><strong>{vendor.shopName}</strong><p className="muted">{vendor.email}</p></div><div className="stack-actions">{!vendor.isVerified ? <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void resendVendorVerification(vendor.id)}>{activeAction === `verify-${vendor.id}` ? "Sending..." : "Verify"}</button> : null}<button className="button" type="button" disabled={activeAction !== null || !vendor.isVerified} onClick={() => void toggleVendor(vendor.id, true)}>{activeAction === `vendor-${vendor.id}` ? "Saving..." : "Activate now"}</button><Link className="button-secondary" href={`/admin/vendors/${vendor.id}`}>Review</Link></div></div><div className="chip-row" style={{ marginTop: "0.75rem" }}><span className={vendor.isVerified ? "badge" : "badge warn"}>{vendor.isVerified ? "Verified" : "Verification pending"}</span><span className="chip">{vendor.approvedAt ? `Approved ${new Date(vendor.approvedAt).toLocaleDateString()}` : "Not activated yet"}</span></div></div>)}</div> : null}
      <table className="table"><thead><tr><th>Shop</th><th>Email</th><th>Verification</th><th>Activation</th><th>Actions</th></tr></thead><tbody>{vendorUsers.map((entry) => <tr key={entry.id}><td><Link className="table-link" href={`/admin/vendors/${entry.vendor_id}`}>{entry.shop_name}</Link></td><td>{entry.email}</td><td><span className={entry.vendor_verified ? "badge" : "badge warn"}>{entry.vendor_verified ? "Verified" : "Pending"}</span></td><td><StatusBadge status={entry.vendor_active ? "active" : "disabled"} /></td><td><div className="stack-actions">{!entry.vendor_verified ? <button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void resendVendorVerification(entry.vendor_id!)}>{activeAction === `verify-${entry.vendor_id}` ? "Sending..." : "Verify"}</button> : null}<button className="button" type="button" disabled={activeAction !== null} onClick={() => void toggleVendor(entry.vendor_id!, !entry.vendor_active)}>{activeAction === `vendor-${entry.vendor_id}` ? "Saving..." : entry.vendor_active ? "Deactivate" : "Activate"}</button><button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void toggleUser(entry.id, !entry.is_active)}>{activeAction === `user-${entry.id}` ? "Saving..." : entry.is_active ? "Disable login" : "Enable login"}</button><button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => void triggerReset(entry.id)}>{activeAction === `reset-${entry.id}` ? "Sending..." : "Send reset"}</button></div></td></tr>)}</tbody></table>
      {vendorUsers.length === 0 ? <div className="empty">No vendors match this queue.</div> : null}
    </section></>}

    {overview && activeView === "customers" && <><section className="mini-stats">
      <div className="mini-stat"><strong>{overview.totals.totalCustomers}</strong><span className="muted">Total customers</span></div>
      <div className="mini-stat"><strong>{customerUsers.length}</strong><span className="muted">Visible in list</span></div>
      <div className="mini-stat"><strong>{customerUsers.filter((entry) => !entry.is_active).length}</strong><span className="muted">Disabled accounts</span></div>
      <div className="mini-stat"><strong>{overview.commerce.ordersThisMonth}</strong><span className="muted">Orders this month</span></div>
    </section><section className="form-card stack">
      <div className="toolbar"><div className="field"><label>Search customers</label><input placeholder="Customer email" value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} /></div></div>
      <div className="chip-row"><button className={customerFilter === "all" ? "button" : "button-secondary"} type="button" onClick={() => setCustomerFilter("all")}>All customers</button><button className={customerFilter === "active" ? "button" : "button-secondary"} type="button" onClick={() => setCustomerFilter("active")}>Active</button><button className={customerFilter === "disabled" ? "button" : "button-secondary"} type="button" onClick={() => setCustomerFilter("disabled")}>Disabled</button></div>
      <table className="table"><thead><tr><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>{customerUsers.map((entry) => <tr key={entry.id}><td><Link className="table-link" href={`/admin/users/${entry.id}`}>{entry.email}</Link></td><td><StatusBadge status={entry.is_active ? "active" : "disabled"} /></td><td><div className="stack-actions"><button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => void toggleUser(entry.id, !entry.is_active)}>{activeAction === `user-${entry.id}` ? "Saving..." : entry.is_active ? "Disable user" : "Enable user"}</button><button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => void triggerReset(entry.id)}>{activeAction === `reset-${entry.id}` ? "Sending..." : "Send reset"}</button></div></td></tr>)}</tbody></table>
      {customerUsers.length === 0 ? <div className="empty">No customers match this queue.</div> : null}
    </section></>}

    {activeView === "orders" && <section className="form-card stack">
      <div className="toolbar"><div className="field"><label>Search orders</label><input placeholder="Order ID or customer email" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /></div><div className="field"><label>Status</label><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value as (typeof orderFilterOptions)[number])}><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option></select></div></div>
      {filteredOrders.map((order) => <div key={order.id} className="card"><div className="admin-order-row"><div className="admin-order-row-main"><Link className="table-link" href={`/admin/orders/${order.id}`}>Order {order.id}</Link><span className="muted">{order.customerEmail}</span><span className="muted">{new Date(order.createdAt).toLocaleString()}</span>{order.cancelRequest?.status === "requested" ? <span className="badge warn">Cancel requested</span> : null}</div><div className="admin-order-row-end"><StatusBadge status={order.status} /><button className="button-ghost admin-order-toggle" type="button" aria-expanded={expandedOrderId === order.id} onClick={() => setExpandedOrderId((current) => current === order.id ? null : order.id)}>{expandedOrderId === order.id ? "v" : ">"}</button></div></div>{expandedOrderId === order.id ? <div className="stack"><div className="order-summary-grid"><div className="mini-stat"><strong>{formatCurrency(order.totalPrice)}</strong><span className="muted">Order total</span></div><div className="mini-stat"><strong>{order.items.length}</strong><span className="muted">Line items</span></div><div className="mini-stat"><strong>{formatCurrency(order.items.reduce((sum, item) => sum + item.commission, 0))}</strong><span className="muted">Commission</span></div><div className="mini-stat"><strong>{formatCurrency(order.items.reduce((sum, item) => sum + item.vendorEarnings, 0))}</strong><span className="muted">Vendor value</span></div></div><div className="card"><strong>{paymentLabel(order)}</strong>{order.specialRequest ? <p className="muted">Request: {order.specialRequest}</p> : null}{order.cancelRequest?.status === "requested" ? <div className="message" style={{ marginTop: "0.75rem" }}>Customer cancel requested{order.cancelRequest.requestedAt ? ` on ${new Date(order.cancelRequest.requestedAt).toLocaleString()}` : ""}{order.cancelRequest.note ? `. Note: ${order.cancelRequest.note}` : "."}</div> : null}{order.items.map((item) => <div key={item.id} className="order-line"><div><strong>{item.product.title}</strong><p className="muted">{item.product.productCode ? `${item.product.productCode} | ` : ""}{item.product.category}{item.product.color ? ` | ${item.product.color}` : ""}{item.product.size ? ` | ${item.product.size}` : ""}{` | Qty ${item.quantity} | ${item.vendor.shopName}`}</p></div><div className="chip-row"><StatusBadge status={item.status} /><span className="chip">{formatCurrency(item.unitPrice)}</span></div></div>)}<div className="inline-actions"><Link className="button-secondary" href={`/admin/orders/${order.id}`}>Open full order</Link></div></div></div> : null}</div>)}
      {filteredOrders.length === 0 ? <div className="empty">No orders match this filter.</div> : null}
    </section>}

    {overview && activeView === "shipping" && <><section className="mini-stats">
      <div className="mini-stat"><strong>{overview.commerce.shippedOrders}</strong><span className="muted">Shipped orders</span></div>
      <div className="mini-stat"><strong>{overview.commerce.deliveredOrders}</strong><span className="muted">Delivered orders</span></div>
      <div className="mini-stat"><strong>{trackedShipments}</strong><span className="muted">Tracked shipments</span></div>
      <div className="mini-stat"><strong>{shippingOrders.length}</strong><span className="muted">Visible shipping orders</span></div>
    </section><section className="form-card stack">
      <div className="toolbar"><div className="field"><label>Search shipping</label><input placeholder="Order ID or customer email" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} /></div><div className="field"><label>Shipment status</label><select value={shippingFilter} onChange={(event) => setShippingFilter(event.target.value as (typeof shippingFilterOptions)[number])}><option value="all">Shipped and delivered</option><option value="shipped">Shipped only</option><option value="delivered">Delivered only</option></select></div></div>
      {shippingOrders.map((order) => <div key={order.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}><div><Link className="table-link" href={`/admin/orders/${order.id}`}>Order {order.id}</Link><p className="muted">{order.customerEmail}</p><p className="muted">{new Date(order.createdAt).toLocaleString()}</p><p className="muted">{paymentLabel(order)}</p></div><div className="chip-row"><StatusBadge status={order.status} /><span className="chip">{order.items.filter((item) => item.shipment?.trackingNumber).length} tracked</span></div></div><div className="order-summary-grid"><div className="mini-stat"><strong>{order.items.length}</strong><span className="muted">Line items</span></div><div className="mini-stat"><strong>{order.items.filter((item) => item.status === "delivered").length}</strong><span className="muted">Delivered items</span></div><div className="mini-stat"><strong>{order.items.filter((item) => item.shipment?.shippedAt).length}</strong><span className="muted">Shipment records</span></div></div></div>)}
      {shippingOrders.length === 0 ? <div className="empty">No shipping records match this filter.</div> : null}
    </section></>}

    {activeView === "payouts" && <><section className="mini-stats">
      <div className="mini-stat"><strong>{payouts.length}</strong><span className="muted">Vendors in payout view</span></div>
      <div className="mini-stat"><strong>{payoutReadyVendors.length}</strong><span className="muted">Ready to pay</span></div>
      <div className="mini-stat"><strong>{formatCurrency(payoutOutstandingTotal)}</strong><span className="muted">Outstanding shipped</span></div>
      <div className="mini-stat"><strong>{formatCurrency(payoutPaidTotal)}</strong><span className="muted">Paid out total</span></div>
    </section><section className="form-card stack">
      <div><h2 className="section-title">Vendor Payouts</h2><p className="muted">Review bank readiness, delivered unpaid balances, and record payout transfers from one admin queue.</p></div>
      {payouts.map((entry) => <div key={entry.vendorId} className="card"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Link className="table-link" href={`/admin/vendors/${entry.vendorId}`}>{entry.shopName}</Link>
          <p className="muted">{entry.vendorEmail}</p>
          <p className="muted">{entry.bankReady ? `${entry.bankName} | ${entry.bankAccountName} | ${entry.bankIban}` : "Bank details are incomplete."}</p>
        </div>
        <div className="chip-row">
          <span className={entry.bankReady ? "badge" : "badge warn"}>{entry.bankReady ? "Bank ready" : "Bank missing"}</span>
          <span className="chip">{entry.orderCount} orders</span>
        </div>
      </div><div className="order-summary-grid">
        <div className="mini-stat"><strong>{formatCurrency(entry.payableNow)}</strong><span className="muted">Pending balance</span></div>
        <div className="mini-stat"><strong>{formatCurrency(entry.outstandingShippedBalance)}</strong><span className="muted">Delivered unpaid</span></div>
        <div className="mini-stat"><strong>{formatCurrency(entry.paidOut)}</strong><span className="muted">Paid out</span></div>
        <div className="mini-stat"><strong>{formatCurrency(entry.totalCommission)}</strong><span className="muted">Commission</span></div>
      </div><div className="inline-actions">
        <button className="button" type="button" disabled={!entry.bankReady || entry.outstandingShippedBalance <= 0} onClick={() => { setPayoutDraftVendorId(entry.vendorId); setPayoutAmount(entry.outstandingShippedBalance.toFixed(2)); setPayoutReference(""); setPayoutNote(""); }}>
          Record payout
        </button>
        <Link className="button-secondary" href={`/admin/vendors/${entry.vendorId}`}>Open vendor</Link>
      </div>{payoutDraftVendorId === entry.vendorId ? <div className="stack" style={{ marginTop: "1rem" }}>
        <div className="field"><label>Payout amount</label><input inputMode="decimal" value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} placeholder="0.00" /></div>
        <div className="field"><label>Reference</label><input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="Transfer reference" /></div>
        <div className="field"><label>Admin note</label><textarea className="input" rows={3} value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} placeholder="Optional payout note" /></div>
        <div className="inline-actions">
          <button className="button" type="button" disabled={activeAction !== null} onClick={() => void recordPayout(entry.vendorId)}>{activeAction === `payout-${entry.vendorId}` ? "Saving..." : "Confirm payout"}</button>
          <button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => setPayoutDraftVendorId(null)}>Cancel</button>
        </div>
      </div> : null}</div>)}
      {payouts.length === 0 ? <div className="empty">No vendor payout data yet.</div> : null}
    </section></>}
  </div></RequireRole>;
}
