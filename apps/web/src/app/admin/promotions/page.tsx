"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl } from "@/lib/api";
import type { AdminPromotion, AdminPromotionSettings } from "@/lib/types";

function isValidDateValue(value?: string | null) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function safeDateInputValue(value?: string | null) {
  return isValidDateValue(value) ? new Date(value as string).toISOString().slice(0, 10) : "";
}

function formatDateForInput(value?: string | null) {
  return safeDateInputValue(value);
}

function formatDisplayDate(value?: string | null, fallback = "Not scheduled") {
  if (!isValidDateValue(value)) {
    return fallback;
  }

  return new Date(value as string).toLocaleDateString();
}

function formatDisplayDateTime(value?: string | null, fallback = "Unknown") {
  if (!isValidDateValue(value)) {
    return fallback;
  }

  return new Date(value as string).toLocaleString();
}

function formatSchedule(promotion: AdminPromotion) {
  if (!promotion.startDate && !promotion.endDate) {
    return "Always on";
  }

  if (promotion.startDate && promotion.endDate) {
    return `${formatDisplayDate(promotion.startDate)} - ${formatDisplayDate(promotion.endDate)}`;
  }

  if (promotion.startDate) {
    return `Starts ${formatDisplayDate(promotion.startDate)}`;
  }

  return `Ends ${formatDisplayDate(promotion.endDate)}`;
}

function isPromotionExpired(promotion: AdminPromotion) {
  return Boolean(
    isValidDateValue(promotion.endDate) &&
      new Date(promotion.endDate as string).getTime() < Date.now(),
  );
}

function normalizePromotion(promotion: Partial<AdminPromotion>): AdminPromotion {
  return {
    id: String(promotion.id ?? ""),
    internalName:
      typeof promotion.internalName === "string" ? promotion.internalName : null,
    desktopImageUrl:
      typeof promotion.desktopImageUrl === "string"
        ? promotion.desktopImageUrl
        : null,
    mobileImageUrl:
      typeof promotion.mobileImageUrl === "string" ? promotion.mobileImageUrl : null,
    customUrl: typeof promotion.customUrl === "string" ? promotion.customUrl : null,
    isActive: Boolean(promotion.isActive),
    displayOrder:
      typeof promotion.displayOrder === "number" && Number.isFinite(promotion.displayOrder)
        ? promotion.displayOrder
        : 0,
    startDate:
      typeof promotion.startDate === "string" && promotion.startDate.trim().length > 0
        ? promotion.startDate
        : null,
    endDate:
      typeof promotion.endDate === "string" && promotion.endDate.trim().length > 0
        ? promotion.endDate
        : null,
    updatedAt:
      typeof promotion.updatedAt === "string" ? promotion.updatedAt : new Date(0).toISOString(),
    isScheduledNow: Boolean(promotion.isScheduledNow),
  };
}

function normalizePromotionSettings(
  settings: Partial<AdminPromotionSettings> | null | undefined,
): AdminPromotionSettings {
  return {
    autoRotate: Boolean(settings?.autoRotate),
    intervalSeconds:
      typeof settings?.intervalSeconds === "number" && Number.isFinite(settings.intervalSeconds)
        ? settings.intervalSeconds
        : 6,
    promotions: Array.isArray(settings?.promotions)
      ? settings!.promotions.map((promotion) => normalizePromotion(promotion))
      : [],
  };
}

export default function AdminPromotionsPage() {
  const { token, currentRole } = useAuth();
  const promotionEditorRef = useRef<HTMLDivElement | null>(null);
  const internalNameInputRef = useRef<HTMLInputElement | null>(null);
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

  const loadPromotions = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiRequest<AdminPromotionSettings>(
        "/admin/promotions",
        undefined,
        token,
      );
      const normalized = normalizePromotionSettings(response);
      setSettings(normalized);
      setAutoRotate(normalized.autoRotate);
      setIntervalSeconds(String(normalized.intervalSeconds));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load promotions.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && currentRole === "admin") {
      void loadPromotions();
    }
  }, [currentRole, loadPromotions, token]);

  useEffect(() => {
    if (!editingPromotionId) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const focusEditor = () => {
      try {
        promotionEditorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      } catch {
        promotionEditorRef.current?.scrollIntoView();
      }

      internalNameInputRef.current?.focus();
    };

    if (typeof window.requestAnimationFrame === "function") {
      const frameId = window.requestAnimationFrame(focusEditor);
      return () => window.cancelAnimationFrame(frameId);
    }

    const timeoutId = window.setTimeout(focusEditor, 0);
    return () => window.clearTimeout(timeoutId);
  }, [editingPromotionId]);

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
      const normalized = normalizePromotionSettings(response);
      setSettings(normalized);
      setAutoRotate(normalized.autoRotate);
      setIntervalSeconds(String(normalized.intervalSeconds));
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
      if (startDate) {
        body.append("startDate", startDate);
      } else if (editingPromotionId) {
        body.append("clearStartDate", "true");
      }
      if (endDate) {
        body.append("endDate", endDate);
      } else if (editingPromotionId) {
        body.append("clearEndDate", "true");
      }
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

      const normalized = normalizePromotionSettings(response);
      setSettings(normalized);
      setAutoRotate(normalized.autoRotate);
      setIntervalSeconds(String(normalized.intervalSeconds));
      resetForm(normalized.promotions.length);
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
      const normalized = normalizePromotionSettings(response);
      setSettings(normalized);
      setAutoRotate(normalized.autoRotate);
      setIntervalSeconds(String(normalized.intervalSeconds));
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
      const normalized = normalizePromotionSettings(response);
      setSettings(normalized);
      setAutoRotate(normalized.autoRotate);
      setIntervalSeconds(String(normalized.intervalSeconds));
      if (editingPromotionId === promotionId) {
        resetForm(normalized.promotions.length);
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

  const promotions = useMemo(() => settings?.promotions ?? [], [settings?.promotions]);
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

              <div className="form-card stack" ref={promotionEditorRef}>
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
                      ref={internalNameInputRef}
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
                          <td>{formatDisplayDateTime(promotion.updatedAt)}</td>
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
                                    {
                                      isActive: !promotion.isActive,
                                      ...(!promotion.isActive &&
                                      isPromotionExpired(promotion)
                                        ? { clearEndDate: true }
                                        : {}),
                                    },
                                    promotion.isActive
                                      ? "Promotion deactivated."
                                      : isPromotionExpired(promotion)
                                        ? "Promotion reactivated and expired end date cleared."
                                        : "Promotion activated.",
                                  )
                                }
                              >
                                {promotion.isActive
                                  ? "Deactivate"
                                  : isPromotionExpired(promotion)
                                    ? "Reactivate"
                                    : "Activate"}
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
