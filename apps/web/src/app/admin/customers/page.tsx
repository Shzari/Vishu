"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest } from "@/lib/api";
import type { AdminUserRow } from "@/lib/types";

export default function AdminCustomersPage() {
  const { token, currentRole } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<AdminUserRow[]>("/admin/users", undefined, token);
      setUsers(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && currentRole === "admin") {
      void loadCustomers();
    }
  }, [currentRole, loadCustomers, token]);

  async function toggleLogin(userId: string, isActive: boolean) {
    if (!token) return;

    try {
      setActiveAction(userId);
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/users/${userId}/activation`,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        token,
      );
      setMessage(isActive ? "Customer login enabled." : "Customer login disabled.");
      await loadCustomers();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update customer login.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const customers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((entry) => entry.role === "customer")
      .filter((entry) => {
        const matchesSearch = !term || entry.email.toLowerCase().includes(term);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && entry.is_active) ||
          (statusFilter === "disabled" && !entry.is_active);
        return matchesSearch && matchesStatus;
      });
  }, [search, statusFilter, users]);

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Customer visibility</span>
            <h1 className="admin-page-title">Customers</h1>
            <p className="admin-page-description">
              Keep customer management simple with a clean list view, account visibility,
              and direct profile access.
            </p>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        <section className="form-card stack">
          <div className="admin-filter-toolbar" style={{ gridTemplateColumns: "minmax(220px, 1.6fr) minmax(160px, 0.7fr) minmax(0, 0.2fr) minmax(0, 0.2fr)" }}>
            <div className="field">
              <label>Search customers</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
              />
            </div>
            <div className="field">
              <label>Account status</label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </section>

        <section className="form-card stack">
          <div>
            <h2 className="section-title">Customer list</h2>
            <p className="muted">{customers.length} customer accounts match the current filters.</p>
          </div>

          {loading ? (
            <div className="message">Loading customers...</div>
          ) : customers.length === 0 ? (
            <div className="empty">No customers match the current filters.</div>
          ) : (
            <div className="table-wrap">
              <table className="admin-simple-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="admin-table-stack">
                          <strong>{customer.email}</strong>
                          <span className="muted">Customer account</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            customer.is_active
                              ? "admin-status-pill active"
                              : "admin-status-pill inactive"
                          }
                        >
                          {customer.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="admin-table-actions">
                          <button
                            className="button-secondary"
                            type="button"
                            disabled={activeAction !== null}
                            onClick={() => void toggleLogin(customer.id, !customer.is_active)}
                          >
                            {activeAction === customer.id
                              ? "Saving..."
                              : customer.is_active
                                ? "Disable login"
                                : "Enable login"}
                          </button>
                          <Link className="button-ghost" href={`/admin/users/${customer.id}`}>
                            Open
                          </Link>
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
