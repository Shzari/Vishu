"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/providers";
import { apiRequest, formatCurrency } from "@/lib/api";
import type {
  AdminCatalogRequest,
  AdminCatalogStructure,
  AdminPlatformSettings,
  AdminUserRow,
  AdminVendorFeeRow,
} from "@/lib/types";

type SettingsSection =
  | "categories"
  | "subcategories"
  | "brands"
  | "colors"
  | "sizes"
  | "gender-groups"
  | "requests"
  | "services";

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Subcategories" },
  { id: "brands", label: "Brands" },
  { id: "colors", label: "Colors" },
  { id: "sizes", label: "Sizes" },
  { id: "gender-groups", label: "Gender Groups" },
  { id: "requests", label: "Requests" },
  { id: "services", label: "Services" },
];

type SimpleForm = { name: string; isActive: boolean; sortOrder: string };
type ServicesSubsection = "email" | "payments" | "admins";

const emptySimpleForm: SimpleForm = { name: "", isActive: true, sortOrder: "0" };
const DEFAULT_PLATFORM_FEE_PER_ORDER = 1;

export default function AdminSettingsPage() {
  const { token, currentRole, user } = useAuth();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("categories");
  const [structure, setStructure] = useState<AdminCatalogStructure | null>(null);
  const [requests, setRequests] = useState<AdminCatalogRequest[]>([]);
  const [platform, setPlatform] = useState<AdminPlatformSettings | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [vendorFees, setVendorFees] = useState<AdminVendorFeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [activeServicesSection, setActiveServicesSection] =
    useState<ServicesSubsection>("email");
  const [selectedAdminIds, setSelectedAdminIds] = useState<Record<string, boolean>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [simpleForm, setSimpleForm] = useState<SimpleForm>(emptySimpleForm);
  const [subcategoryForm, setSubcategoryForm] = useState({
    categoryId: "",
    name: "",
    isActive: true,
    sortOrder: "0",
  });
  const [sizeTypeForm, setSizeTypeForm] = useState<SimpleForm>(emptySimpleForm);
  const [sizeForm, setSizeForm] = useState({
    sizeTypeId: "",
    label: "",
    isActive: true,
    sortOrder: "0",
  });

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("2525");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [mailFrom, setMailFrom] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [vendorVerificationEmailsEnabled, setVendorVerificationEmailsEnabled] =
    useState(true);
  const [adminVendorApprovalEmailsEnabled, setAdminVendorApprovalEmailsEnabled] =
    useState(true);
  const [passwordResetEmailsEnabled, setPasswordResetEmailsEnabled] =
    useState(true);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [paymentMode, setPaymentMode] = useState<"test" | "live">("test");
  const [cashOnDeliveryEnabled, setCashOnDeliveryEnabled] = useState(true);
  const [cardPaymentsEnabled, setCardPaymentsEnabled] = useState(false);
  const [guestCheckoutEnabled, setGuestCheckoutEnabled] = useState(true);
  const [stripeTestPublishableKey, setStripeTestPublishableKey] = useState("");
  const [stripeLivePublishableKey, setStripeLivePublishableKey] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  const loadAdminUsers = useCallback(async () => {
    if (!token) {
      return [];
    }

    const response = await apiRequest<AdminUserRow[]>("/admin/users", {}, token);
    return response.filter((entry) => entry.role === "admin");
  }, [token]);

  useEffect(() => {
    if (!token || currentRole !== "admin") return;
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [structureResponse, requestResponse, platformResponse, adminUserResponse, vendorFeeResponse] =
          await Promise.all([
            apiRequest<AdminCatalogStructure>("/admin/catalog-structure", {}, token),
            apiRequest<AdminCatalogRequest[]>("/admin/catalog-requests?status=all", {}, token),
            apiRequest<AdminPlatformSettings>("/admin/platform-settings", {}, token),
            loadAdminUsers(),
            apiRequest<AdminVendorFeeRow[]>("/admin/vendor-fees", {}, token),
          ]);
        if (!active) return;
        setStructure(structureResponse);
        setRequests(requestResponse);
        setPlatform(platformResponse);
        setVendorFees(vendorFeeResponse);
        const emailConfig = platformResponse.email;
        const paymentConfig = platformResponse.payment;
        setAdminUsers(
          [...adminUserResponse].sort(
            (left, right) =>
              Number(right.is_active) - Number(left.is_active) ||
              new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
          ),
        );
        setSelectedAdminIds({});
        setSmtpHost(emailConfig?.smtpHost ?? "");
        setSmtpPort(emailConfig?.smtpPort ? String(emailConfig.smtpPort) : "2525");
        setSmtpSecure(emailConfig?.smtpSecure ?? false);
        setSmtpUser(emailConfig?.smtpUser ?? "");
        setMailFrom(emailConfig?.mailFrom ?? "");
        setAppBaseUrl(
          emailConfig?.appBaseUrl ?? (typeof window !== "undefined" ? window.location.origin : ""),
        );
        setVendorVerificationEmailsEnabled(emailConfig?.vendorVerificationEmailsEnabled ?? true);
        setAdminVendorApprovalEmailsEnabled(emailConfig?.adminVendorApprovalEmailsEnabled ?? true);
        setPasswordResetEmailsEnabled(emailConfig?.passwordResetEmailsEnabled ?? true);
        setPaymentMode(paymentConfig?.mode ?? "test");
        setCashOnDeliveryEnabled(paymentConfig?.cashOnDeliveryEnabled ?? true);
        setCardPaymentsEnabled(paymentConfig?.cardPaymentsEnabled ?? false);
        setGuestCheckoutEnabled(paymentConfig?.guestCheckoutEnabled ?? true);
        setStripeTestPublishableKey(paymentConfig?.stripe?.test?.publishableKey ?? "");
        setStripeLivePublishableKey(paymentConfig?.stripe?.live?.publishableKey ?? "");
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentRole, loadAdminUsers, token]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (typeFilter !== "all" && request.requestType !== typeFilter) return false;
        if (statusFilter !== "all" && request.status !== statusFilter) return false;
        return true;
      }),
    [requests, statusFilter, typeFilter],
  );

  const activeAdminCount = adminUsers.filter((entry) => entry.is_active).length;
  const disabledAdminCount = adminUsers.length - activeAdminCount;
  const selectableAdminUsers = adminUsers.filter((entry) => entry.id !== user?.sub);
  const allSelectableAdminsSelected =
    selectableAdminUsers.length > 0 &&
    selectableAdminUsers.every((entry) => selectedAdminIds[entry.id]);
  const selectedAdminList = adminUsers.filter((entry) => selectedAdminIds[entry.id]);
  const actionableSelectedAdmins = selectedAdminList.filter((entry) => entry.id !== user?.sub);
  const totalCollectedFees = vendorFees.reduce((sum, entry) => sum + entry.totalFeePaid, 0);
  const totalOutstandingFees = vendorFees.reduce((sum, entry) => sum + entry.outstandingFee, 0);
  const servicesRecentActivity = platform?.activityLog?.slice(0, 6) ?? [];
  const emailActivity = (platform?.activityLog ?? []).filter(
    (entry) =>
      entry.actionType.includes("email") ||
      entry.entityType.includes("email") ||
      entry.description.toLowerCase().includes("email"),
  );
  const adminActivity = (platform?.activityLog ?? []).filter(
    (entry) =>
      entry.actionType.includes("admin") ||
      entry.entityType.includes("admin") ||
      entry.entityType.includes("platform_settings"),
  );
  const smtpReady = Boolean(
    (smtpHost || platform?.email.smtpHost) &&
      (mailFrom || platform?.email.mailFrom) &&
      (platform?.email.smtpPasswordConfigured || smtpPassword),
  );
  const emailAutomationEnabledCount = [
    vendorVerificationEmailsEnabled,
    adminVendorApprovalEmailsEnabled,
    passwordResetEmailsEnabled,
  ].filter(Boolean).length;
  const paymentHealthReady = Boolean(
    platform?.payment.status.activeConfigurationComplete &&
      platform.payment.status.activeWebhookConfigured,
  );
  const platformHealthCards = [
    {
      label: "Email delivery",
      value: smtpReady ? "Ready" : "Needs setup",
      tone: smtpReady ? "success" : "warn",
      detail: smtpReady ? "SMTP host, sender, and password are in place." : "SMTP settings are still incomplete.",
    },
    {
      label: "Payments",
      value: paymentHealthReady ? "Healthy" : "Attention",
      tone: paymentHealthReady ? "success" : "warn",
      detail: paymentHealthReady
        ? `${platform?.payment.status.activeMode === "live" ? "Live" : "Test"} mode is fully configured.`
        : "Stripe setup still needs keys or webhook configuration.",
    },
    {
      label: "Admin access",
      value: `${activeAdminCount} active`,
      tone: activeAdminCount > 0 ? "success" : "warn",
      detail: `${disabledAdminCount} disabled admin logins.`,
    },
    {
      label: "Vendor fees",
      value: formatCurrency(totalCollectedFees),
      tone: totalCollectedFees > 0 ? "success" : "warn",
      detail: `${formatCurrency(totalOutstandingFees)} still outstanding across vendors.`,
    },
  ] as const;

  async function saveStructure(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE" = "POST") {
    if (!token) return;
    try {
      setActiveAction(path);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AdminCatalogStructure>(
        path,
        method === "DELETE" ? { method } : { method, body: JSON.stringify(body) },
        token,
      );
      setStructure(next);
      setMessage("Marketplace structure updated.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function savePlatform() {
    if (!token) return;
    try {
      setActiveAction("platform");
      setMessage(null);
      setError(null);
      const next = await apiRequest<AdminPlatformSettings>(
        "/admin/platform-settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            smtpHost: smtpHost || null,
            smtpPort: smtpPort ? Number(smtpPort) : null,
            smtpSecure,
            smtpUser: smtpUser || null,
            smtpPassword: smtpPassword || undefined,
            clearSmtpPassword,
            mailFrom: mailFrom || null,
            appBaseUrl: appBaseUrl || null,
            vendorVerificationEmailsEnabled,
            adminVendorApprovalEmailsEnabled,
            passwordResetEmailsEnabled,
          }),
        },
        token,
      );
      setPlatform(next);
      setSmtpPassword("");
      setClearSmtpPassword(false);
      setMessage("Email settings saved.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to save email settings.");
    } finally {
      setActiveAction(null);
    }
  }

  async function sendTestEmail() {
    if (!token || !testEmailRecipient.trim()) return;
    try {
      setActiveAction("test-email");
      const response = await apiRequest<{ message: string }>(
        "/admin/platform-settings/test-email",
        { method: "POST", body: JSON.stringify({ email: testEmailRecipient.trim() }) },
        token,
      );
      setMessage(response.message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to send test email.");
    } finally {
      setActiveAction(null);
    }
  }

  async function savePayment() {
    if (!token) return;
    try {
      setActiveAction("payment");
      setMessage(null);
      setError(null);
      const next = await apiRequest<AdminPlatformSettings>(
        "/admin/platform-settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            paymentMode,
            cashOnDeliveryEnabled,
            cardPaymentsEnabled,
            guestCheckoutEnabled,
            stripeTestPublishableKey,
            stripeLivePublishableKey,
          }),
        },
        token,
      );
      setPlatform(next);
      setMessage("Payment settings saved.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to save payment settings.");
    } finally {
      setActiveAction(null);
    }
  }

  async function createAdmin() {
    if (!token) return;
    try {
      setActiveAction("create-admin");
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string; admin: { email: string } }>(
        "/admin/admins",
        {
          method: "POST",
          body: JSON.stringify({ fullName: fullName || undefined, email, phoneNumber: phoneNumber || undefined, password }),
        },
        token,
      );
      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setAdminUsers(await loadAdminUsers());
      setMessage(`${response.message}: ${response.admin.email}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to create admin.");
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleAdminAccess(nextUser: AdminUserRow) {
    if (!token) return;

    try {
      setActiveAction(`admin-access-${nextUser.id}`);
      setMessage(null);
      setError(null);
      await apiRequest(
        `/admin/users/${nextUser.id}/activation`,
        {
          method: "PATCH",
          body: JSON.stringify({ isActive: !nextUser.is_active }),
        },
        token,
      );
      setAdminUsers(await loadAdminUsers());
      setMessage(
        nextUser.is_active
          ? `Admin login disabled for ${nextUser.email}.`
          : `Admin login enabled for ${nextUser.email}.`,
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update admin access.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function applyBulkAdminAccess(nextIsActive: boolean) {
    if (!token || actionableSelectedAdmins.length === 0) return;

    try {
      setActiveAction(nextIsActive ? "bulk-enable-admins" : "bulk-disable-admins");
      setMessage(null);
      setError(null);
      await Promise.all(
        actionableSelectedAdmins.map((adminUser) =>
          apiRequest(
            `/admin/users/${adminUser.id}/activation`,
            {
              method: "PATCH",
              body: JSON.stringify({ isActive: nextIsActive }),
            },
            token,
          ),
        ),
      );
      setAdminUsers(await loadAdminUsers());
      setSelectedAdminIds({});
      setMessage(
        nextIsActive
          ? `Enabled ${actionableSelectedAdmins.length} admin accounts.`
          : `Disabled ${actionableSelectedAdmins.length} admin accounts.`,
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update selected admin accounts.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  const categories = structure?.categories ?? [];
  const subcategories = structure?.subcategories ?? [];
  const brands = structure?.brands ?? [];
  const colors = structure?.colors ?? [];
  const sizeTypes = structure?.sizeTypes ?? [];
  const sizes = structure?.sizes ?? [];
  const genderGroups = structure?.genderGroups ?? [];

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Marketplace structure</span>
            <h1 className="admin-page-title">Settings</h1>
            <p className="admin-page-description">
              Control catalog structure, payments, email, requests, and admin access from one structured panel.
            </p>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        {loading ? <div className="message">Loading settings...</div> : null}

        <div className="admin-structure-layout">
          <aside className="form-card stack admin-settings-sidebar">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={activeSection === section.id ? "button admin-settings-nav active" : "button-ghost admin-settings-nav"}
                onClick={() => {
                  setActiveSection(section.id);
                  setEditingId(null);
                  setSimpleForm(emptySimpleForm);
                }}
              >
                {section.label}
              </button>
            ))}
          </aside>

          <div className="stack" style={{ flex: 1 }}>
            {activeSection === "categories" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">{editingId ? "Edit category" : "Add category"}</h2>
                  <div className="form-grid two">
                    <div className="field"><label>Name</label><input value={simpleForm.name} onChange={(event) => setSimpleForm((current) => ({ ...current, name: event.target.value }))} /></div>
                    <div className="field"><label>Sort order</label><input type="number" value={simpleForm.sortOrder} onChange={(event) => setSimpleForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
                  </div>
                  <label className="vendor-row-check"><input type="checkbox" checked={simpleForm.isActive} onChange={(event) => setSimpleForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
                  <div className="inline-actions">
                    <button className="button" type="button" disabled={activeAction !== null || simpleForm.name.trim().length === 0} onClick={() => void saveStructure(editingId ? `/admin/catalog/categories/${editingId}` : "/admin/catalog/categories", { name: simpleForm.name, isActive: simpleForm.isActive, sortOrder: Number(simpleForm.sortOrder || 0) }, editingId ? "PATCH" : "POST").then(() => { setEditingId(null); setSimpleForm(emptySimpleForm); })}>{editingId ? "Save category" : "Add category"}</button>
                  </div>
                </section>
                <section className="form-card stack">
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead><tr><th>Name</th><th>Status</th><th>Sort</th><th>Actions</th></tr></thead>
                      <tbody>
                        {categories.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td>{item.sortOrder}</td>
                            <td><div className="inline-actions"><button className="button-ghost" type="button" onClick={() => { setEditingId(item.id); setSimpleForm({ name: item.name, isActive: item.isActive, sortOrder: String(item.sortOrder) }); }}>Edit</button><button className="button-ghost" type="button" onClick={() => void saveStructure(`/admin/catalog/categories/${item.id}`, {}, "DELETE")}>Remove</button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "subcategories" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">Subcategories</h2>
                  <div className="form-grid two">
                    <div className="field"><label>Category</label><select value={subcategoryForm.categoryId} onChange={(event) => setSubcategoryForm((current) => ({ ...current, categoryId: event.target.value }))}><option value="">Select category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                    <div className="field"><label>Name</label><input value={subcategoryForm.name} onChange={(event) => setSubcategoryForm((current) => ({ ...current, name: event.target.value }))} /></div>
                  </div>
                  <div className="form-grid two">
                    <div className="field"><label>Sort order</label><input type="number" value={subcategoryForm.sortOrder} onChange={(event) => setSubcategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
                    <label className="vendor-row-check"><input type="checkbox" checked={subcategoryForm.isActive} onChange={(event) => setSubcategoryForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
                  </div>
                  <div className="inline-actions"><button className="button" type="button" disabled={activeAction !== null || subcategoryForm.categoryId.length === 0 || subcategoryForm.name.trim().length === 0} onClick={() => void saveStructure(editingId ? `/admin/catalog/subcategories/${editingId}` : "/admin/catalog/subcategories", { categoryId: subcategoryForm.categoryId, name: subcategoryForm.name, isActive: subcategoryForm.isActive, sortOrder: Number(subcategoryForm.sortOrder || 0) }, editingId ? "PATCH" : "POST").then(() => { setEditingId(null); setSubcategoryForm({ categoryId: "", name: "", isActive: true, sortOrder: "0" }); })}>{editingId ? "Save subcategory" : "Add subcategory"}</button></div>
                </section>
                <section className="form-card stack">
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead><tr><th>Name</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {subcategories.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.categoryName}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td><div className="inline-actions"><button className="button-ghost" type="button" onClick={() => { setEditingId(item.id); setSubcategoryForm({ categoryId: item.categoryId, name: item.name, isActive: item.isActive, sortOrder: String(item.sortOrder) }); }}>Edit</button><button className="button-ghost" type="button" onClick={() => void saveStructure(`/admin/catalog/subcategories/${item.id}`, {}, "DELETE")}>Remove</button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "brands" || activeSection === "colors" || activeSection === "gender-groups" ? (
              <section className="form-card stack">
                <h2 className="section-title">{activeSection === "brands" ? "Brands" : activeSection === "colors" ? "Colors" : "Gender Groups"}</h2>
                <div className="form-grid two">
                  <div className="field"><label>Name</label><input value={simpleForm.name} onChange={(event) => setSimpleForm((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="field"><label>Sort order</label><input type="number" value={simpleForm.sortOrder} onChange={(event) => setSimpleForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
                </div>
                <label className="vendor-row-check"><input type="checkbox" checked={simpleForm.isActive} onChange={(event) => setSimpleForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
                <div className="inline-actions"><button className="button" type="button" disabled={activeAction !== null || simpleForm.name.trim().length === 0} onClick={() => { const base = activeSection === "brands" ? "/admin/catalog/brands" : activeSection === "colors" ? "/admin/catalog/colors" : "/admin/catalog/gender-groups"; void saveStructure(editingId ? `${base}/${editingId}` : base, { name: simpleForm.name, isActive: simpleForm.isActive, sortOrder: Number(simpleForm.sortOrder || 0) }, editingId ? "PATCH" : "POST").then(() => { setEditingId(null); setSimpleForm(emptySimpleForm); }); }}>{editingId ? "Save" : "Add"}</button></div>
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(activeSection === "brands" ? brands : activeSection === "colors" ? colors : genderGroups).map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.isActive ? "Active" : "Inactive"}</td>
                          <td><div className="inline-actions"><button className="button-ghost" type="button" onClick={() => { setEditingId(item.id); setSimpleForm({ name: item.name, isActive: item.isActive, sortOrder: String(item.sortOrder) }); }}>Edit</button><button className="button-ghost" type="button" onClick={() => { const base = activeSection === "brands" ? "/admin/catalog/brands" : activeSection === "colors" ? "/admin/catalog/colors" : "/admin/catalog/gender-groups"; void saveStructure(`${base}/${item.id}`, {}, "DELETE"); }}>Remove</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeSection === "sizes" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">Size Types</h2>
                  <div className="form-grid two">
                    <div className="field"><label>Name</label><input value={sizeTypeForm.name} onChange={(event) => setSizeTypeForm((current) => ({ ...current, name: event.target.value }))} /></div>
                    <div className="field"><label>Sort order</label><input type="number" value={sizeTypeForm.sortOrder} onChange={(event) => setSizeTypeForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
                  </div>
                  <label className="vendor-row-check"><input type="checkbox" checked={sizeTypeForm.isActive} onChange={(event) => setSizeTypeForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
                  <div className="inline-actions"><button className="button" type="button" disabled={sizeTypeForm.name.trim().length === 0} onClick={() => void saveStructure("/admin/catalog/size-types", { name: sizeTypeForm.name, isActive: sizeTypeForm.isActive, sortOrder: Number(sizeTypeForm.sortOrder || 0) }, "POST").then(() => setSizeTypeForm(emptySimpleForm))}>Add size type</button></div>
                </section>
                <section className="form-card stack">
                  <h2 className="section-title">Sizes</h2>
                  <div className="form-grid two">
                    <div className="field"><label>Size type</label><select value={sizeForm.sizeTypeId} onChange={(event) => setSizeForm((current) => ({ ...current, sizeTypeId: event.target.value }))}><option value="">Select size type</option>{sizeTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                    <div className="field"><label>Label</label><input value={sizeForm.label} onChange={(event) => setSizeForm((current) => ({ ...current, label: event.target.value }))} /></div>
                  </div>
                  <div className="form-grid two">
                    <div className="field"><label>Sort order</label><input type="number" value={sizeForm.sortOrder} onChange={(event) => setSizeForm((current) => ({ ...current, sortOrder: event.target.value }))} /></div>
                    <label className="vendor-row-check"><input type="checkbox" checked={sizeForm.isActive} onChange={(event) => setSizeForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
                  </div>
                  <div className="inline-actions"><button className="button" type="button" disabled={sizeForm.sizeTypeId.length === 0 || sizeForm.label.trim().length === 0} onClick={() => void saveStructure(editingId ? `/admin/catalog/sizes/${editingId}` : "/admin/catalog/sizes", { sizeTypeId: sizeForm.sizeTypeId, label: sizeForm.label, isActive: sizeForm.isActive, sortOrder: Number(sizeForm.sortOrder || 0) }, editingId ? "PATCH" : "POST").then(() => { setEditingId(null); setSizeForm({ sizeTypeId: "", label: "", isActive: true, sortOrder: "0" }); })}>{editingId ? "Save size" : "Add size"}</button></div>
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead><tr><th>Type</th><th>Size</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        {sizes.map((item) => (
                          <tr key={item.id}>
                            <td>{item.sizeTypeName}</td>
                            <td>{item.label}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td><div className="inline-actions"><button className="button-ghost" type="button" onClick={() => { setEditingId(item.id); setSizeForm({ sizeTypeId: item.sizeTypeId, label: item.label, isActive: item.isActive, sortOrder: String(item.sortOrder) }); }}>Edit</button><button className="button-ghost" type="button" onClick={() => void saveStructure(`/admin/catalog/sizes/${item.id}`, {}, "DELETE")}>Remove</button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "requests" ? (
              <section className="form-card stack">
                <div className="admin-filter-toolbar">
                  <div className="field"><label>Type</label><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All</option><option value="category">Category</option><option value="subcategory">Subcategory</option><option value="brand">Brand</option><option value="size">Size</option><option value="color">Color</option></select></div>
                  <div className="field"><label>Status</label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
                </div>
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead><tr><th>Request</th><th>Vendor</th><th>Status</th><th>Review</th></tr></thead>
                    <tbody>
                      {filteredRequests.map((request) => (
                        <tr key={request.id}>
                          <td><div className="admin-table-stack"><strong>{request.requestedValue}</strong><span className="muted">{request.requestType}{request.categoryName ? ` · ${request.categoryName}` : ""}{request.subcategoryName ? ` · ${request.subcategoryName}` : ""}{request.sizeTypeName ? ` · ${request.sizeTypeName}` : ""}</span></div></td>
                          <td>{request.vendor.shopName}</td>
                          <td>{request.status}</td>
                          <td>{request.status === "pending" ? <div className="stack"><textarea className="input admin-request-note" rows={3} value={noteById[request.id] ?? ""} onChange={(event) => setNoteById((current) => ({ ...current, [request.id]: event.target.value }))} /><div className="inline-actions"><button className="button" type="button" onClick={async () => { if (!token) return; const next = await apiRequest<AdminCatalogRequest[]>(`/admin/catalog-requests/${request.id}/review`, { method: "PATCH", body: JSON.stringify({ status: "approved", adminNote: noteById[request.id] || undefined }) }, token); setRequests(next); }}>Approve</button><button className="button-ghost" type="button" onClick={async () => { if (!token) return; const next = await apiRequest<AdminCatalogRequest[]>(`/admin/catalog-requests/${request.id}/review`, { method: "PATCH", body: JSON.stringify({ status: "rejected", adminNote: noteById[request.id] || undefined }) }, token); setRequests(next); }}>Reject</button></div></div> : request.adminNote ?? "Reviewed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeSection === "services" ? (
              <>
                <section className="form-card stack">
                  <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 className="section-title">Platform health</h2>
                      <p className="muted">
                        A quick read on service readiness, recent admin activity, and the key
                        metrics behind marketplace operations.
                      </p>
                    </div>
                    <span className={paymentHealthReady && smtpReady ? "badge success" : "badge warn"}>
                      {paymentHealthReady && smtpReady ? "Core services healthy" : "Configuration needs attention"}
                    </span>
                  </div>

                  <div className="admin-services-health-grid">
                    {platformHealthCards.map((card) => (
                      <div key={card.label} className="card stack admin-services-health-card">
                        <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                          <span className="muted">{card.label}</span>
                          <span className={card.tone === "success" ? "badge success" : "badge warn"}>
                            {card.value}
                          </span>
                        </div>
                        <p className="muted">{card.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="admin-services-dashboard-grid">
                    <div className="card stack">
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <strong>Recent activity</strong>
                        <span className="badge">{servicesRecentActivity.length} entries</span>
                      </div>
                      {servicesRecentActivity.length === 0 ? (
                        <div className="empty">No recent admin activity yet.</div>
                      ) : (
                        servicesRecentActivity.map((entry) => (
                          <div key={entry.id} className="vendor-activity-row">
                            <div>
                              <strong>{entry.actionType}</strong>
                              <p className="muted">{entry.description}</p>
                            </div>
                            <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="card stack">
                      <strong>Key metrics</strong>
                      <div className="mini-stats">
                        <div className="mini-stat">
                          <span>Fee collected</span>
                          <strong>{formatCurrency(totalCollectedFees)}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Pending requests</span>
                          <strong>{requests.filter((entry) => entry.status === "pending").length}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Email automations</span>
                          <strong>{emailAutomationEnabledCount}/3</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Payment logs</span>
                          <strong>{platform?.payment.logs.length ?? 0}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="form-card stack">
                  <div className="admin-services-tabbar">
                    <button
                      type="button"
                      className={activeServicesSection === "email" ? "button admin-settings-nav active" : "button-ghost admin-settings-nav"}
                      onClick={() => setActiveServicesSection("email")}
                    >
                      Email & Communication
                    </button>
                    <button
                      type="button"
                      className={activeServicesSection === "payments" ? "button admin-settings-nav active" : "button-ghost admin-settings-nav"}
                      onClick={() => setActiveServicesSection("payments")}
                    >
                      Payments & Billing
                    </button>
                    <button
                      type="button"
                      className={activeServicesSection === "admins" ? "button admin-settings-nav active" : "button-ghost admin-settings-nav"}
                      onClick={() => setActiveServicesSection("admins")}
                    >
                      Admin Management
                    </button>
                  </div>
                </section>

                {activeServicesSection === "email" ? (
                  <>
                    <section className="form-card stack">
                      {platform?.email.smtpPasswordManagedByEnv ? (
                        <div className="message">
                          SMTP password is currently managed by the server environment. The database copy is ignored while `SMTP_PASS` is set.
                        </div>
                      ) : null}
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h2 className="section-title">Email & Communication</h2>
                          <p className="muted">
                            Manage SMTP delivery, notification toggles, and test sends with
                            quick readiness indicators.
                          </p>
                        </div>
                        <div className="inline-actions">
                          <span className={smtpReady ? "badge success" : "badge warn"}>
                            {smtpReady ? "Connection ready" : "Connection incomplete"}
                          </span>
                          <span className={emailAutomationEnabledCount > 0 ? "badge success" : "badge warn"}>
                            {emailAutomationEnabledCount}/3 automations on
                          </span>
                        </div>
                      </div>

                      <div className="mini-stats">
                        <div className="mini-stat">
                          <span>SMTP host</span>
                          <strong>{smtpHost || platform?.email.smtpHost || "Missing"}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Sender</span>
                          <strong>{mailFrom || platform?.email.mailFrom || "Missing"}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Password</span>
                          <strong>
                            {platform?.email.smtpPasswordManagedByEnv
                              ? "Env managed"
                              : platform?.email.smtpPasswordConfigured
                                ? "Saved"
                                : "Missing"}
                          </strong>
                        </div>
                        <div className="mini-stat">
                          <span>Delivery logs</span>
                          <strong>{emailActivity.length}</strong>
                        </div>
                      </div>

                      <div className="admin-services-dashboard-grid">
                        <div className="card stack">
                          <strong>SMTP configuration</strong>
                          <div className="form-grid two">
                            <div className="field"><label>SMTP host</label><input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} /></div>
                            <div className="field"><label>SMTP port</label><input value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} /></div>
                          </div>
                          <div className="form-grid two">
                            <div className="field"><label>SMTP user</label><input value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} /></div>
                            <div className="field"><label>SMTP password</label><input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} /></div>
                          </div>
                          <div className="form-grid two">
                            <div className="field"><label>Mail from</label><input value={mailFrom} onChange={(event) => setMailFrom(event.target.value)} /></div>
                            <div className="field"><label>App base URL</label><input value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} /></div>
                          </div>
                          <label className="vendor-row-check"><input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} /><span>Secure SMTP</span></label>
                          <label className="vendor-row-check"><input type="checkbox" checked={clearSmtpPassword} onChange={(event) => setClearSmtpPassword(event.target.checked)} /><span>Clear saved password</span></label>
                          <div className="inline-actions">
                            <button className="button" type="button" onClick={() => void savePlatform()} disabled={activeAction === "platform"}>
                              Save email settings
                            </button>
                          </div>
                        </div>

                        <div className="card stack">
                          <strong>Automation and testing</strong>
                          <label className="vendor-row-check"><input type="checkbox" checked={vendorVerificationEmailsEnabled} onChange={(event) => setVendorVerificationEmailsEnabled(event.target.checked)} /><span>Vendor verification emails</span></label>
                          <label className="vendor-row-check"><input type="checkbox" checked={adminVendorApprovalEmailsEnabled} onChange={(event) => setAdminVendorApprovalEmailsEnabled(event.target.checked)} /><span>Admin approval emails</span></label>
                          <label className="vendor-row-check"><input type="checkbox" checked={passwordResetEmailsEnabled} onChange={(event) => setPasswordResetEmailsEnabled(event.target.checked)} /><span>Password reset emails</span></label>
                          <div className="inline-actions" style={{ alignItems: "end" }}>
                            <div className="field" style={{ minWidth: "260px" }}>
                              <label>Test email recipient</label>
                              <input value={testEmailRecipient} onChange={(event) => setTestEmailRecipient(event.target.value)} placeholder="admin@vishu.shop" />
                            </div>
                            <button className="button-secondary" type="button" onClick={() => void sendTestEmail()} disabled={activeAction === "test-email"}>
                              {activeAction === "test-email" ? "Sending..." : "Send test email"}
                            </button>
                          </div>
                          <div className="stack">
                            <strong>Delivery logs</strong>
                            {emailActivity.length === 0 ? (
                              <div className="empty">No email delivery activity yet.</div>
                            ) : (
                              emailActivity.slice(0, 6).map((entry) => (
                                <div key={entry.id} className="vendor-activity-row">
                                  <div>
                                    <strong>{entry.actionType}</strong>
                                    <p className="muted">{entry.description}</p>
                                  </div>
                                  <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  </>
                ) : null}

                {activeServicesSection === "payments" ? (
                  <section className="form-card stack">
                    <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <h2 className="section-title">Payments & Billing</h2>
                        <p className="muted">
                          Configure Stripe, choose active payment modes, and keep fee visibility
                          tied back to the dedicated vendor fee ledger.
                        </p>
                      </div>
                      <div className="inline-actions">
                        <span className={platform?.payment.status.activeConfigurationComplete ? "badge success" : "badge warn"}>
                          {platform?.payment.status.activeConfigurationComplete ? "Stripe ready" : "Stripe incomplete"}
                        </span>
                        <span className={platform?.payment.status.activeWebhookConfigured ? "badge success" : "badge warn"}>
                          {platform?.payment.status.activeWebhookConfigured ? "Webhook configured" : "Webhook missing"}
                        </span>
                      </div>
                    </div>

                    <div className="admin-services-dashboard-grid">
                      <div className="card stack">
                        <strong>Payment configuration</strong>
                        <div className="mini-stats">
                          <div className="mini-stat">
                            <span>Active mode</span>
                            <strong>{platform?.payment.status.activeMode === "live" ? "Live" : "Test"}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Public key</span>
                            <strong>{platform?.payment.status.activePublishableKey ? "Configured" : "Missing"}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Secret key</span>
                            <strong>{platform?.payment.status.activeConfigurationComplete ? "Ready" : "Missing"}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Webhook</span>
                            <strong>{platform?.payment.status.activeWebhookConfigured ? "Ready" : "Missing"}</strong>
                          </div>
                        </div>

                        {!platform?.payment.status.activeConfigurationComplete ? (
                          <div className="message">
                            The active payment mode still needs both a publishable key and a secret key. Secret keys stay server-side and should be provided through env vars when possible.
                          </div>
                        ) : null}

                        <div className="form-grid two">
                          <div className="field">
                            <label>Payment mode</label>
                            <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as "test" | "live")}>
                              <option value="test">Test</option>
                              <option value="live">Live</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>Guest checkout</label>
                            <select value={guestCheckoutEnabled ? "enabled" : "disabled"} onChange={(event) => setGuestCheckoutEnabled(event.target.value === "enabled")}>
                              <option value="enabled">Enabled</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                        </div>

                        <label className="vendor-row-check"><input type="checkbox" checked={cashOnDeliveryEnabled} onChange={(event) => setCashOnDeliveryEnabled(event.target.checked)} /><span>Cash on delivery enabled</span></label>
                        <label className="vendor-row-check"><input type="checkbox" checked={cardPaymentsEnabled} onChange={(event) => setCardPaymentsEnabled(event.target.checked)} /><span>Card payments enabled</span></label>

                        <div className="form-grid two">
                          <div className="field">
                            <label>Stripe test publishable key</label>
                            <input value={stripeTestPublishableKey} onChange={(event) => setStripeTestPublishableKey(event.target.value)} placeholder="pk_test_..." />
                          </div>
                          <div className="field">
                            <label>Stripe live publishable key</label>
                            <input value={stripeLivePublishableKey} onChange={(event) => setStripeLivePublishableKey(event.target.value)} placeholder="pk_live_..." />
                          </div>
                        </div>

                        <div className="message">
                          Secret keys and webhook signing secrets are not edited here. Runtime will use env vars first when they are present, which is the preferred production setup.
                        </div>

                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => void savePayment()} disabled={activeAction === "payment"}>
                            Save payment settings
                          </button>
                        </div>
                      </div>

                      <div className="card stack">
                        <strong>Platform fees</strong>
                        <div className="mini-stats">
                          <div className="mini-stat">
                            <span>Default fee per order</span>
                            <strong>{formatCurrency(DEFAULT_PLATFORM_FEE_PER_ORDER)}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Total collected</span>
                            <strong>{formatCurrency(totalCollectedFees)}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Outstanding</span>
                            <strong>{formatCurrency(totalOutstandingFees)}</strong>
                          </div>
                          <div className="mini-stat">
                            <span>Tracked vendors</span>
                            <strong>{vendorFees.length}</strong>
                          </div>
                        </div>
                        <p className="muted">
                          Vendor fees are managed per vendor, but new shops still start from the
                          marketplace default before any override. Use the dedicated fee ledger for
                          payment history and vendor-by-vendor fee review.
                        </p>
                        <div className="inline-actions">
                          <Link className="button-secondary" href="/admin/fees">
                            Open vendor fee ledger
                          </Link>
                        </div>

                        <div className="stack">
                          <strong>Payment activity</strong>
                          {platform?.payment.logs?.length ? (
                            platform.payment.logs.slice(0, 6).map((entry) => (
                              <div key={entry.id} className="vendor-activity-row">
                                <div>
                                  <strong>{entry.eventType}</strong>
                                  <p className="muted">{entry.message ?? entry.eventStatus}</p>
                                </div>
                                <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                              </div>
                            ))
                          ) : platform?.payment.status.lastEvent ? (
                            <div className="vendor-activity-row">
                              <div>
                                <strong>{platform.payment.status.lastEvent.eventType}</strong>
                                <p className="muted">
                                  {platform.payment.status.lastEvent.message ?? platform.payment.status.lastEvent.eventStatus}
                                </p>
                              </div>
                              <span className="muted">
                                {new Date(platform.payment.status.lastEvent.createdAt).toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <div className="empty">No payment logs available yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeServicesSection === "admins" ? (
                  <>
                    <section className="form-card stack">
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h2 className="section-title">Admin Management</h2>
                          <p className="muted">
                            Create admin accounts, manage access in bulk, and review the recent
                            activity tied to platform operations.
                          </p>
                        </div>
                        <div className="inline-actions">
                          <span className="badge success">{activeAdminCount} active</span>
                          <span className={disabledAdminCount > 0 ? "badge warn" : "badge success"}>
                            {disabledAdminCount} disabled
                          </span>
                        </div>
                      </div>

                      <div className="admin-services-dashboard-grid">
                        <div className="card stack">
                          <strong>Grant admin access</strong>
                          <p className="muted">
                            Create a new admin account for marketplace management, approvals, and settings.
                          </p>
                          <div className="form-grid two"><div className="field"><label>Full name</label><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></div><div className="field"><label>Email</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div></div>
                          <div className="form-grid two"><div className="field"><label>Phone number</label><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></div><div className="field"><label>Password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></div>
                          <div className="inline-actions"><button className="button" type="button" onClick={() => void createAdmin()} disabled={activeAction === "create-admin"}>Create admin</button></div>
                        </div>

                        <div className="card stack">
                          <strong>Activity tracking</strong>
                          {adminActivity.length === 0 ? (
                            <div className="empty">No admin activity captured yet.</div>
                          ) : (
                            adminActivity.slice(0, 8).map((entry) => (
                              <div key={entry.id} className="vendor-activity-row">
                                <div>
                                  <strong>{entry.actionType}</strong>
                                  <p className="muted">{entry.description}</p>
                                </div>
                                <span className="muted">{new Date(entry.createdAt).toLocaleString()}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>

                    <section className="form-card stack">
                      <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <h2 className="section-title">Current admin access</h2>
                          <p className="muted">
                            Review every account that can enter the admin portal and use bulk actions
                            when you need to enable or disable multiple admin logins quickly.
                          </p>
                        </div>
                        <Link className="button-ghost" href="/admin/customers">
                          Open user management
                        </Link>
                      </div>

                      <div className="mini-stats">
                        <div className="mini-stat">
                          <span>Total admins</span>
                          <strong>{adminUsers.length}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Selected</span>
                          <strong>{actionableSelectedAdmins.length}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Current account</span>
                          <strong>{user?.email ?? "Signed in"}</strong>
                        </div>
                      </div>

                      <div className="message">
                        The currently signed-in admin account stays visible here, but it cannot disable itself from this panel.
                      </div>

                      <div className="inline-actions">
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={actionableSelectedAdmins.length === 0 || activeAction !== null}
                          onClick={() => void applyBulkAdminAccess(true)}
                        >
                          {activeAction === "bulk-enable-admins" ? "Saving..." : "Enable selected"}
                        </button>
                        <button
                          className="button-ghost"
                          type="button"
                          disabled={actionableSelectedAdmins.length === 0 || activeAction !== null}
                          onClick={() => void applyBulkAdminAccess(false)}
                        >
                          {activeAction === "bulk-disable-admins" ? "Saving..." : "Disable selected"}
                        </button>
                      </div>

                      {adminUsers.length === 0 ? (
                        <div className="empty">No admin accounts have been created yet.</div>
                      ) : (
                        <div className="table-wrap">
                          <table className="admin-simple-table">
                            <thead>
                              <tr>
                                <th>
                                  <input
                                    type="checkbox"
                                    checked={allSelectableAdminsSelected}
                                    onChange={(event) =>
                                      setSelectedAdminIds(
                                        event.target.checked
                                          ? Object.fromEntries(
                                              selectableAdminUsers.map((entry) => [entry.id, true]),
                                            )
                                          : {},
                                      )
                                    }
                                  />
                                </th>
                                <th>Admin user</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminUsers.map((adminUser) => {
                                const isCurrentUser = adminUser.id === user?.sub;

                                return (
                                  <tr key={adminUser.id}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(selectedAdminIds[adminUser.id])}
                                        disabled={isCurrentUser}
                                        onChange={(event) =>
                                          setSelectedAdminIds((current) => ({
                                            ...current,
                                            [adminUser.id]: event.target.checked,
                                          }))
                                        }
                                      />
                                    </td>
                                    <td>
                                      <div className="admin-table-stack">
                                        <strong>{adminUser.email}</strong>
                                        <span className="muted">
                                          {isCurrentUser ? "Current signed-in admin" : "Admin portal access"}
                                        </span>
                                      </div>
                                    </td>
                                    <td>
                                      <span
                                        className={
                                          adminUser.is_active
                                            ? "admin-status-pill active"
                                            : "admin-status-pill inactive"
                                        }
                                      >
                                        {adminUser.is_active ? "Active" : "Disabled"}
                                      </span>
                                    </td>
                                    <td>{new Date(adminUser.created_at).toLocaleDateString()}</td>
                                    <td>
                                      <div className="admin-table-actions">
                                        <button
                                          className="button-secondary"
                                          type="button"
                                          disabled={isCurrentUser || activeAction !== null}
                                          onClick={() => void toggleAdminAccess(adminUser)}
                                        >
                                          {activeAction === `admin-access-${adminUser.id}`
                                            ? "Saving..."
                                            : isCurrentUser
                                              ? "Current account"
                                              : adminUser.is_active
                                                ? "Disable login"
                                                : "Enable login"}
                                        </button>
                                        <Link className="button-ghost" href={`/admin/users/${adminUser.id}`}>
                                          Open
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
