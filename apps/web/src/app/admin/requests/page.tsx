"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest } from "@/lib/api";
import type { AdminCatalogRequest } from "@/lib/types";

const REQUEST_TYPE_LABELS: Record<AdminCatalogRequest["requestType"], string> = {
  brand: "Brand",
  category: "Category",
  color: "Color",
  size: "Size",
  subcategory: "Subcategory",
};

export default function AdminRequestsPage() {
  const { token, currentRole } = useAuth();
  const [requests, setRequests] = useState<AdminCatalogRequest[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(
    async (nextType = typeFilter, nextStatus = statusFilter) => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (nextType !== "all") params.set("type", nextType);
      if (nextStatus !== "all") params.set("status", nextStatus);
      const response = await apiRequest<AdminCatalogRequest[]>(
        `/admin/catalog-requests${params.toString() ? `?${params.toString()}` : ""}`,
        undefined,
        token,
      );
      setRequests(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load requests.",
      );
    } finally {
      setLoading(false);
    }
    },
    [statusFilter, token, typeFilter],
  );

  useEffect(() => {
    if (token && currentRole === "admin") {
      void loadRequests();
    }
  }, [currentRole, loadRequests, token]);

  async function reviewRequest(
    requestId: string,
    status: "approved" | "rejected",
  ) {
    if (!token) return;

    try {
      setActiveAction(`${requestId}-${status}`);
      setMessage(null);
      setError(null);
      await apiRequest<AdminCatalogRequest[]>(
        `/admin/catalog-requests/${requestId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            adminNote: noteById[requestId]?.trim() || undefined,
          }),
        },
        token,
      );
      await loadRequests(typeFilter, statusFilter);
      setMessage(status === "approved" ? "Request approved." : "Request rejected.");
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Failed to review request.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const summary = useMemo(
    () => ({
      pending: requests.filter((entry) => entry.status === "pending").length,
      approved: requests.filter((entry) => entry.status === "approved").length,
      rejected: requests.filter((entry) => entry.status === "rejected").length,
    }),
    [requests],
  );

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Approval workflow</span>
            <h1 className="admin-page-title">Requests</h1>
            <p className="admin-page-description">
              Review vendor requests for structured catalog values. Approval only marks a
              request as approved so the value can be created properly later in Settings.
            </p>
          </div>
          <div className="admin-page-actions">
            <Link className="button-secondary" href="/admin/settings">
              Open settings
            </Link>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        <section className="mini-stats">
          <div className="mini-stat">
            <strong>{summary.pending}</strong>
            <span className="muted">Pending</span>
          </div>
          <div className="mini-stat">
            <strong>{summary.approved}</strong>
            <span className="muted">Approved</span>
          </div>
          <div className="mini-stat">
            <strong>{summary.rejected}</strong>
            <span className="muted">Rejected</span>
          </div>
        </section>

        <section className="form-card stack">
          <div className="admin-filter-toolbar">
            <div className="field">
              <label>Request type</label>
              <select
                value={typeFilter}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTypeFilter(nextValue);
                  void loadRequests(nextValue, statusFilter);
                }}
              >
                <option value="all">All types</option>
                <option value="category">Category</option>
                <option value="subcategory">Subcategory</option>
                <option value="brand">Brand</option>
                <option value="size">Size</option>
                <option value="color">Color</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={statusFilter}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setStatusFilter(nextValue);
                  void loadRequests(typeFilter, nextValue);
                }}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </section>

        <section className="form-card stack">
          <div>
            <h2 className="section-title">Vendor-submitted requests</h2>
            <p className="muted">
              Use this queue to approve or reject requests, then create the real structure item
              manually in Settings if needed.
            </p>
          </div>

          {loading ? (
            <div className="message">Loading requests...</div>
          ) : requests.length === 0 ? (
            <div className="empty">No requests match the current filters.</div>
          ) : (
            <div className="table-wrap">
              <table className="admin-simple-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Vendor</th>
                    <th>Status</th>
                    <th>Note</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className="admin-table-stack">
                          <strong>{request.requestedValue}</strong>
                          <span className="muted">
                            {REQUEST_TYPE_LABELS[request.requestType]}
                            {request.categoryName ? ` · ${request.categoryName}` : ""}
                            {request.subcategoryName ? ` · ${request.subcategoryName}` : ""}
                            {request.sizeTypeName ? ` · ${request.sizeTypeName}` : ""}
                          </span>
                          <span className="muted">
                            Submitted {new Date(request.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-stack">
                          <strong>{request.vendor.shopName}</strong>
                          <span className="muted">{request.vendor.email}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`admin-status-pill ${request.status === "pending" ? "pending" : request.status === "approved" ? "approved" : "rejected"}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-table-stack">
                          <span className="muted">{request.note ?? "No vendor note"}</span>
                          {request.status === "pending" ? (
                            <textarea
                              className="input admin-request-note"
                              rows={3}
                              value={noteById[request.id] ?? request.adminNote ?? ""}
                              onChange={(event) =>
                                setNoteById((current) => ({
                                  ...current,
                                  [request.id]: event.target.value,
                                }))
                              }
                              placeholder="Optional admin note"
                            />
                          ) : (
                            <span className="muted">
                              {request.adminNote
                                ? `Admin note: ${request.adminNote}`
                                : request.reviewedAt
                                  ? `Reviewed ${new Date(request.reviewedAt).toLocaleString()}`
                                  : "No admin note"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          {request.status === "pending" ? (
                            <>
                              <button
                                className="button"
                                type="button"
                                disabled={activeAction !== null}
                                onClick={() => void reviewRequest(request.id, "approved")}
                              >
                                {activeAction === `${request.id}-approved`
                                  ? "Saving..."
                                  : "Approve"}
                              </button>
                              <button
                                className="button-secondary"
                                type="button"
                                disabled={activeAction !== null}
                                onClick={() => void reviewRequest(request.id, "rejected")}
                              >
                                {activeAction === `${request.id}-rejected`
                                  ? "Saving..."
                                  : "Reject"}
                              </button>
                            </>
                          ) : (
                            <Link className="button-ghost" href="/admin/settings">
                              Go to settings
                            </Link>
                          )}
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
