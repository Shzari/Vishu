"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type {
  AdminCatalogRequest,
  AdminCatalogStructure,
  AdminPlatformSettings,
} from "@/lib/types";

type SettingsSection =
  | "categories"
  | "subcategories"
  | "brands"
  | "colors"
  | "sizes"
  | "gender-groups"
  | "requests"
  | "email-settings"
  | "admin-access";

const SECTIONS: Array<{ id: SettingsSection; label: string }> = [
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Subcategories" },
  { id: "brands", label: "Brands" },
  { id: "colors", label: "Colors" },
  { id: "sizes", label: "Sizes" },
  { id: "gender-groups", label: "Gender Groups" },
  { id: "requests", label: "Requests" },
  { id: "email-settings", label: "Email Settings" },
  { id: "admin-access", label: "Admin Access" },
];

type SimpleForm = { name: string; isActive: boolean; sortOrder: string };

const emptySimpleForm: SimpleForm = { name: "", isActive: true, sortOrder: "0" };

export default function AdminSettingsPage() {
  const { token, currentRole } = useAuth();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("categories");
  const [structure, setStructure] = useState<AdminCatalogStructure | null>(null);
  const [requests, setRequests] = useState<AdminCatalogRequest[]>([]);
  const [platform, setPlatform] = useState<AdminPlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token || currentRole !== "admin") return;
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [structureResponse, requestResponse, platformResponse] =
          await Promise.all([
            apiRequest<AdminCatalogStructure>("/admin/catalog-structure", {}, token),
            apiRequest<AdminCatalogRequest[]>("/admin/catalog-requests?status=all", {}, token),
            apiRequest<AdminPlatformSettings>("/admin/platform-settings", {}, token),
          ]);
        if (!active) return;
        setStructure(structureResponse);
        setRequests(requestResponse);
        setPlatform(platformResponse);
        setSmtpHost(platformResponse.email.smtpHost ?? "");
        setSmtpPort(platformResponse.email.smtpPort ? String(platformResponse.email.smtpPort) : "2525");
        setSmtpSecure(platformResponse.email.smtpSecure);
        setSmtpUser(platformResponse.email.smtpUser ?? "");
        setMailFrom(platformResponse.email.mailFrom ?? "");
        setAppBaseUrl(platformResponse.email.appBaseUrl ?? window.location.origin);
        setVendorVerificationEmailsEnabled(platformResponse.email.vendorVerificationEmailsEnabled);
        setAdminVendorApprovalEmailsEnabled(platformResponse.email.adminVendorApprovalEmailsEnabled);
        setPasswordResetEmailsEnabled(platformResponse.email.passwordResetEmailsEnabled);
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
  }, [currentRole, token]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (typeFilter !== "all" && request.requestType !== typeFilter) return false;
        if (statusFilter !== "all" && request.status !== statusFilter) return false;
        return true;
      }),
    [requests, statusFilter, typeFilter],
  );

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

  async function createAdmin() {
    if (!token) return;
    try {
      setActiveAction("create-admin");
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
      setMessage(`${response.message}: ${response.admin.email}`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to create admin.");
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
              Control categories, brands, colors, sizes, requests, email, and admin access from one structured panel.
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

            {activeSection === "email-settings" ? (
              <section className="form-card stack">
                <div className="form-grid two"><div className="field"><label>SMTP host</label><input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} /></div><div className="field"><label>SMTP port</label><input value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} /></div></div>
                <div className="form-grid two"><div className="field"><label>SMTP user</label><input value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} /></div><div className="field"><label>SMTP password</label><input type="password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} /></div></div>
                <div className="form-grid two"><div className="field"><label>Mail from</label><input value={mailFrom} onChange={(event) => setMailFrom(event.target.value)} /></div><div className="field"><label>App base URL</label><input value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} /></div></div>
                <label className="vendor-row-check"><input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} /><span>Secure SMTP</span></label>
                <label className="vendor-row-check"><input type="checkbox" checked={clearSmtpPassword} onChange={(event) => setClearSmtpPassword(event.target.checked)} /><span>Clear saved password</span></label>
                <label className="vendor-row-check"><input type="checkbox" checked={vendorVerificationEmailsEnabled} onChange={(event) => setVendorVerificationEmailsEnabled(event.target.checked)} /><span>Vendor verification emails</span></label>
                <label className="vendor-row-check"><input type="checkbox" checked={adminVendorApprovalEmailsEnabled} onChange={(event) => setAdminVendorApprovalEmailsEnabled(event.target.checked)} /><span>Admin approval emails</span></label>
                <label className="vendor-row-check"><input type="checkbox" checked={passwordResetEmailsEnabled} onChange={(event) => setPasswordResetEmailsEnabled(event.target.checked)} /><span>Password reset emails</span></label>
                <div className="inline-actions"><button className="button" type="button" onClick={() => void savePlatform()} disabled={activeAction === "platform"}>Save email settings</button></div>
                <div className="inline-actions" style={{ alignItems: "end" }}><div className="field" style={{ minWidth: "260px" }}><label>Test email</label><input value={testEmailRecipient} onChange={(event) => setTestEmailRecipient(event.target.value)} /></div><button className="button-secondary" type="button" onClick={() => void sendTestEmail()} disabled={activeAction === "test-email"}>Send test</button></div>
                {platform?.activityLog?.length ? platform.activityLog.slice(0, 6).map((entry) => <div key={entry.id} className="vendor-activity-row"><div><strong>{entry.actionType}</strong><p className="muted">{entry.description}</p></div><span className="muted">{new Date(entry.createdAt).toLocaleString()}</span></div>) : null}
              </section>
            ) : null}

            {activeSection === "admin-access" ? (
              <section className="form-card stack">
                <div className="form-grid two"><div className="field"><label>Full name</label><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></div><div className="field"><label>Email</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div></div>
                <div className="form-grid two"><div className="field"><label>Phone number</label><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} /></div><div className="field"><label>Password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></div>
                <div className="inline-actions"><button className="button" type="button" onClick={() => void createAdmin()} disabled={activeAction === "create-admin"}>Create admin</button></div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </RequireRole>
  );
}
