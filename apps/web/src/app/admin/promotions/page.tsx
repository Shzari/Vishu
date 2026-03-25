"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl } from "@/lib/api";
import type { AdminPromotion, AdminPromotionSettings } from "@/lib/types";

function formatDateForInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatSchedule(promotion: AdminPromotion) {
  if (!promotion.startDate && !promotion.endDate) {
    return "Always on";
  }

  if (promotion.startDate && promotion.endDate) {
    return `${new Date(promotion.startDate).toLocaleDateString()} - ${new Date(promotion.endDate).toLocaleDateString()}`;
  }

  if (promotion.startDate) {
    return `Starts ${new Date(promotion.startDate).toLocaleDateString()}`;
  }

  return `Ends ${new Date(promotion.endDate ?? "").toLocaleDateString()}`;
}

export default function AdminPromotionsPage() {
  const { token, currentRole } = useAuth();
  const [settings, setSettings] = useState<AdminPromotionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [submittingPromotion, setSubmittingPromotion] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingPromotionId, setEditingPromotionId] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [intervalSeconds, setIntervalSeconds] = useState("6");
  const [internalName, setInternalName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clearMobileImage, setClearMobileImage] = useState(false);
  const [desktopImageFile, setDesktopImageFile] = useState<File | null>(null);
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null);
  const [existingDesktopImageUrl, setExistingDesktopImageUrl] = useState<string | null>(null);
  const [existingMobileImageUrl, setExistingMobileImageUrl] = useState<string | null>(null);

  async function loadPromotions() {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<AdminPromotionSettings>(
        "/admin/promotions",
        undefined,
        token,
      );
      setSettings(response);
      setAutoRotate(response.autoRotate);
      setIntervalSeconds(String(response.intervalSeconds));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load promotions.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && currentRole === "admin") {
      void loadPromotions();
    }
  }, [currentRole, token]);

  function resetForm(nextOrder?: number) {
    setEditingPromotionId(null);
    setInternalName("");
    setCustomUrl("");
    setIsActive(true);
    setDisplayOrder(String(nextOrder ?? settings?.promotions.length ?? 0));
    setStartDate("");
    setEndDate("");
    setClearMobileImage(false);
    setDesktopImageFile(null);
    setMobileImageFile(null);
    setExistingDesktopImageUrl(null);
    setExistingMobileImageUrl(null);
  }

  function startEditingPromotion(promotion: AdminPromotion) {
    setEditingPromotionId(promotion.id);
    setInternalName(promotion.internalName ?? "");
    setCustomUrl(promotion.customUrl ?? "");
    setIsActive(promotion.isActive);
    setDisplayOrder(String(promotion.displayOrder));
    setStartDate(formatDateForInput(promotion.startDate));
    setEndDate(formatDateForInput(promotion.endDate));
    setClearMobileImage(false);
    setDesktopImageFile(null);
    setMobileImageFile(null);
    setExistingDesktopImageUrl(promotion.desktopImageUrl ?? null);
    setExistingMobileImageUrl(promotion.mobileImageUrl ?? null);
    setMessage(null);
    setError(null);
  }

  async function savePromotionSettings() {
    if (!token) return;

    try {
      setSavingSettings(true);
      setMessage(null);
      setError(null);
      const response = await apiRequest<AdminPromotionSettings>(
        "/admin/promotions/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            autoRotate,
            intervalSeconds: Number(intervalSeconds),
          }),
        },
        token,
      );
      setSettings(response);
      setAutoRotate(response.autoRotate);
      setIntervalSeconds(String(response.intervalSeconds));
      setMessage("Promotion slider settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save promotion settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitPromotion() {
    if (!token) return;

    if (!internalName.trim()) {
      setError("Internal name is required.");
      return;
    }

    if (!customUrl.trim()) {
      setError("Custom URL is required.");
      return;
    }

    if (!editingPromotionId && !desktopImageFile) {
      setError("Desktop banner image is required.");
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError("End date cannot be before start date.");
      return;
    }

    try {
      setSubmittingPromotion(true);
      setMessage(null);
      setError(null);

      const body = new FormData();
      body.append("internalName", internalName.trim());
      body.append("customUrl", customUrl.trim());
      body.append("isActive", String(isActive));
      body.append("displayOrder", displayOrder || "0");
      if (startDate) body.append("startDate", startDate);
      if (endDate) body.append("endDate", endDate);
      if (desktopImageFile) body.append("desktopBannerImage", desktopImageFile);
      if (mobileImageFile) body.append("mobileBannerImage", mobileImageFile);
      if (clearMobileImage) body.append("clearMobileImage", "true");

      const response = await apiRequest<AdminPromotionSettings>(
        editingPromotionId
          ? `/admin/promotions/${editingPromotionId}`
          : "/admin/promotions",
        {
          method: editingPromotionId ? "PATCH" : "POST",
          body,
        },
        token,
      );

      setSettings(response);
      setAutoRotate(response.autoRotate);
      setIntervalSeconds(String(response.intervalSeconds));
      resetForm(response.promotions.length);
      setMessage(
        editingPromotionId
          ? "Promotion updated."
          : "Promotion created.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save promotion.",
      );
    } finally {
      setSubmittingPromotion(false);
    }
  }

  async function patchPromotion(
    promotionId: string,
    values: Record<string, string | boolean | number>,
    successMessage: string,
  ) {
    if (!token) return;

    try {
      setActiveAction(promotionId);
      setMessage(null);
      setError(null);
      const body = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        body.append(key, String(value));
      });
      const response = await apiRequest<AdminPromotionSettings>(
        `/admin/promotions/${promotionId}`,
        {
          method: "PATCH",
          body,
        },
        token,
      );
      setSettings(response);
      setAutoRotate(response.autoRotate);
      setIntervalSeconds(String(response.intervalSeconds));
      setMessage(successMessage);
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : "Failed to update promotion.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function deletePromotion(promotionId: string) {
    if (!token) return;

    try {
      setActiveAction(`delete-${promotionId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<AdminPromotionSettings>(
        `/admin/promotions/${promotionId}`,
        {
          method: "DELETE",
        },
        token,
      );
      setSettings(response);
      setAutoRotate(response.autoRotate);
      setIntervalSeconds(String(response.intervalSeconds));
      if (editingPromotionId === promotionId) {
        resetForm(response.promotions.length);
      }
      setMessage("Promotion deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete promotion.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const promotions = settings?.promotions ?? [];
  const sortedPromotions = useMemo(
    () => [...promotions].sort((a, b) => a.displayOrder - b.displayOrder),
    [promotions],
  );

  if (!token || currentRole !== "admin") {
    return (
      <RequireRole requiredRole="admin">
        <div className="message error">
          Login with an admin account to manage promotions.
        </div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="stack">
        <section className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 className="section-title">Promotions</h1>
              <p className="muted">
                Upload ready-made homepage banners, attach links, schedule them,
                and control the hero slider from one place.
              </p>
            </div>
            <div className="inline-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={() => resetForm(promotions.length)}
              >
                New promotion
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={() => void loadPromotions()}
              >
                Refresh
              </button>
            </div>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        {loading ? <div className="message">Loading promotions...</div> : null}

        {!loading ? (
          <>
            <section className="split">
              <div className="form-card stack">
                <div>
                  <h2 className="section-title">Slider Settings</h2>
                  <p className="muted">
                    Control autoplay globally. The homepage only renders active
                    banners that are inside their scheduled dates.
                  </p>
                </div>
                <div className="form-grid two">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={autoRotate}
                      onChange={(event) => setAutoRotate(event.target.checked)}
                    />
                    <span>Enable auto rotation</span>
                  </label>
                  <div className="field">
                    <label>Rotation interval in seconds</label>
                    <input
                      inputMode="numeric"
                      value={intervalSeconds}
                      onChange={(event) => setIntervalSeconds(event.target.value)}
                    />
                  </div>
                </div>
                <div className="inline-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={savingSettings}
                    onClick={() => void savePromotionSettings()}
                  >
                    {savingSettings ? "Saving..." : "Save slider settings"}
                  </button>
                </div>
              </div>

              <div className="form-card stack">
                <div>
                  <h2 className="section-title">
                    {editingPromotionId ? "Edit Promotion" : "Create Promotion"}
                  </h2>
                  <p className="muted">
                    Desktop image and custom URL are required. Mobile image is
                    optional.
                  </p>
                </div>

                <div className="form-grid two">
                  <div className="field">
                    <label>Internal name</label>
                    <input
                      value={internalName}
                      onChange={(event) => setInternalName(event.target.value)}
                      placeholder="Summer sale hero"
                    />
                  </div>
                  <div className="field">
                    <label>Custom URL</label>
                    <input
                      value={customUrl}
                      onChange={(event) => setCustomUrl(event.target.value)}
                      placeholder="/shops or https://example.com/collection"
                    />
                  </div>
                  <div className="field">
                    <label>Display order</label>
                    <input
                      inputMode="numeric"
                      value={displayOrder}
                      onChange={(event) => setDisplayOrder(event.target.value)}
                    />
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(event) => setIsActive(event.target.checked)}
                    />
                    <span>Promotion active</span>
                  </label>
                  <div className="field">
                    <label>Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Desktop banner image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setDesktopImageFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {desktopImageFile ? (
                      <span className="muted">{desktopImageFile.name}</span>
                    ) : existingDesktopImageUrl ? (
                      <span className="muted">Current desktop banner stored.</span>
                    ) : null}
                  </div>
                  <div className="field">
                    <label>Mobile banner image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setMobileImageFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {mobileImageFile ? (
                      <span className="muted">{mobileImageFile.name}</span>
                    ) : existingMobileImageUrl ? (
                      <span className="muted">Current mobile banner stored.</span>
                    ) : (
                      <span className="muted">Optional mobile-specific artwork.</span>
                    )}
                  </div>
                </div>

                {editingPromotionId && existingMobileImageUrl ? (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={clearMobileImage}
                      onChange={(event) => setClearMobileImage(event.target.checked)}
                    />
                    <span>Remove current mobile image on save</span>
                  </label>
                ) : null}

                <div className="promotion-preview-grid">
                  {existingDesktopImageUrl ? (
                    <div className="card">
                      <strong>Desktop preview</strong>
                      <img
                        className="promotion-admin-thumb-large"
                        src={assetUrl(existingDesktopImageUrl)}
                        alt="Desktop promotion preview"
                      />
                    </div>
                  ) : null}
                  {existingMobileImageUrl ? (
                    <div className="card">
                      <strong>Mobile preview</strong>
                      <img
                        className="promotion-admin-thumb-large promotion-admin-thumb-mobile"
                        src={assetUrl(existingMobileImageUrl)}
                        alt="Mobile promotion preview"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="inline-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={submittingPromotion}
                    onClick={() => void submitPromotion()}
                  >
                    {submittingPromotion
                      ? "Saving..."
                      : editingPromotionId
                        ? "Save promotion"
                        : "Create promotion"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => resetForm(promotions.length)}
                  >
                    Clear form
                  </button>
                </div>
              </div>
            </section>

            <section className="form-card stack">
              <div>
                <h2 className="section-title">Promotion List</h2>
                <p className="muted">
                  Review banner status, scheduling, order, and quick actions.
                </p>
              </div>

              {sortedPromotions.length === 0 ? (
                <div className="message">
                  No promotions yet. Create the first homepage banner above.
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Banner</th>
                        <th>Internal name</th>
                        <th>Custom URL</th>
                        <th>Status</th>
                        <th>Schedule</th>
                        <th>Order</th>
                        <th>Last updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPromotions.map((promotion, index) => (
                        <tr key={promotion.id}>
                          <td>
                            {promotion.desktopImageUrl ? (
                              <img
                                className="promotion-admin-thumb"
                                src={assetUrl(promotion.desktopImageUrl)}
                                alt={promotion.internalName ?? "Promotion banner"}
                              />
                            ) : (
                              <div className="promotion-admin-thumb promotion-admin-thumb-empty">
                                No image
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>{promotion.internalName ?? "Untitled"}</strong>
                          </td>
                          <td>
                            <span className="muted">{promotion.customUrl}</span>
                          </td>
                          <td>
                            <div className="stack" style={{ gap: "0.2rem" }}>
                              <span className="chip">
                                {promotion.isActive ? "Active" : "Inactive"}
                              </span>
                              <span className="muted">
                                {promotion.isScheduledNow ? "In schedule" : "Out of schedule"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="muted">{formatSchedule(promotion)}</span>
                          </td>
                          <td>{promotion.displayOrder}</td>
                          <td>{new Date(promotion.updatedAt).toLocaleString()}</td>
                          <td>
                            <div className="inline-actions">
                              <button
                                className="button-secondary"
                                type="button"
                                onClick={() => startEditingPromotion(promotion)}
                              >
                                Edit
                              </button>
                              <button
                                className="button-secondary"
                                type="button"
                                disabled={activeAction === promotion.id}
                                onClick={() =>
                                  void patchPromotion(
                                    promotion.id,
                                    { isActive: !promotion.isActive },
                                    promotion.isActive
                                      ? "Promotion deactivated."
                                      : "Promotion activated.",
                                  )
                                }
                              >
                                {promotion.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                className="button-secondary"
                                type="button"
                                disabled={index === 0 || activeAction === promotion.id}
                                onClick={() =>
                                  void patchPromotion(
                                    promotion.id,
                                    { displayOrder: Math.max(0, promotion.displayOrder - 1) },
                                    "Promotion order updated.",
                                  )
                                }
                              >
                                Up
                              </button>
                              <button
                                className="button-secondary"
                                type="button"
                                disabled={
                                  index === sortedPromotions.length - 1 ||
                                  activeAction === promotion.id
                                }
                                onClick={() =>
                                  void patchPromotion(
                                    promotion.id,
                                    { displayOrder: promotion.displayOrder + 1 },
                                    "Promotion order updated.",
                                  )
                                }
                              >
                                Down
                              </button>
                              <button
                                className="danger-button"
                                type="button"
                                disabled={activeAction === `delete-${promotion.id}`}
                                onClick={() => void deletePromotion(promotion.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </RequireRole>
  );
}
