"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { VendorWorkspaceShell } from "@/components/vendor-workspace-shell";
import { apiRequest, assetUrl } from "@/lib/api";
import type { AccountSettingsProfile, VendorTeamAccessResponse, VendorAccessRole } from "@/lib/types";

export default function VendorSettingsPage() {
  const { token, currentRole, refreshProfile, profile } = useAuth();
  const [settings, setSettings] = useState<AccountSettingsProfile | null>(null);
  const [teamAccess, setTeamAccess] = useState<VendorTeamAccessResponse | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [shippingNotes, setShippingNotes] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamSaving, setTeamSaving] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<VendorAccessRole>("employee");
  const [inviteNote, setInviteNote] = useState("");
  const vendorAccessRole = profile?.vendor?.access_role ?? "shop_holder";
  const canManageSettings = profile?.vendor?.access_role === "shop_holder";

  async function loadSettings() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [data, nextTeamAccess] = await Promise.all([
        apiRequest<AccountSettingsProfile>("/account/settings", undefined, token),
        canManageSettings
          ? apiRequest<VendorTeamAccessResponse>("/account/vendor-team", undefined, token)
          : Promise.resolve(null),
      ]);
      setSettings(data);
      setTeamAccess(nextTeamAccess);
      setFullName(data.fullName ?? "");
      setEmail(data.email);
      setPhoneNumber(data.phoneNumber ?? "");
      setShopName(data.vendor?.shopName ?? "");
      setSupportEmail(data.vendor?.supportEmail ?? "");
      setSupportPhone(data.vendor?.supportPhone ?? "");
      setShopDescription(data.vendor?.shopDescription ?? "");
      setLogoUrl(data.vendor?.logoUrl ?? "");
      setBannerUrl(data.vendor?.bannerUrl ?? "");
      setBusinessAddress(data.vendor?.businessAddress ?? "");
      setReturnPolicy(data.vendor?.returnPolicy ?? "");
      setBusinessHours(data.vendor?.businessHours ?? "");
      setShippingNotes(data.vendor?.shippingNotes ?? "");
      setLowStockThreshold(String(data.vendor?.lowStockThreshold ?? 5));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vendor settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && currentRole === "vendor" && canManageSettings) {
      void loadSettings();
    }
  }, [canManageSettings, currentRole, token]);

  async function refreshTeamAccess() {
    if (!token || !canManageSettings) return;
    const nextTeamAccess = await apiRequest<VendorTeamAccessResponse>("/account/vendor-team", undefined, token);
    setTeamAccess(nextTeamAccess);
  }

  const logoPreviewUrl = useMemo(() => {
    if (!logoFile) {
      return null;
    }

    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  async function saveProfile() {
    if (!token) return;
    const emailChanged = email.trim().toLowerCase() !== settings?.email.trim().toLowerCase();
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AccountSettingsProfile>(
        "/account/profile",
        {
          method: "PATCH",
          body: JSON.stringify({ fullName, email, phoneNumber }),
        },
        token,
      );
      setSettings(next);
      await refreshProfile();
      setMessage(
        emailChanged
          ? "Vendor profile updated. Verify your new email before your next sign in."
          : "Vendor profile updated.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vendor profile.");
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!token || !settings) return;

    try {
      setResendingVerification(true);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        "/auth/verification/resend",
        {
          method: "POST",
          body: JSON.stringify({ email: settings.email }),
        },
        token,
      );
      setMessage(response.message);
    } catch (resendError) {
      setError(
        resendError instanceof Error ? resendError.message : "Could not resend verification email.",
      );
    } finally {
      setResendingVerification(false);
    }
  }

  async function saveVendorProfile() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const body = new FormData();
      body.append("shopName", shopName);
      if (supportEmail) body.append("supportEmail", supportEmail);
      if (supportPhone) body.append("supportPhone", supportPhone);
      if (shopDescription) body.append("shopDescription", shopDescription);
      if (!logoFile && logoUrl) body.append("logoUrl", logoUrl);
      if (logoFile) body.append("logoImage", logoFile);
      if (bannerUrl) body.append("bannerUrl", bannerUrl);
      if (businessAddress) body.append("businessAddress", businessAddress);
      if (returnPolicy) body.append("returnPolicy", returnPolicy);
      if (businessHours) body.append("businessHours", businessHours);
      if (shippingNotes) body.append("shippingNotes", shippingNotes);
      body.append("lowStockThreshold", String(Number(lowStockThreshold || 0)));
      const next = await apiRequest<AccountSettingsProfile>(
        "/account/vendor-profile",
        {
          method: "PATCH",
          body,
        },
        token,
      );
      setSettings(next);
      setLogoUrl(next.vendor?.logoUrl ?? "");
      setLogoFile(null);
      await refreshProfile();
      setMessage("Vendor shop profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vendor shop profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        "/account/password",
        {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        token,
      );
      setCurrentPassword("");
      setNewPassword("");
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  async function inviteTeamMember() {
    if (!token) return;
    try {
      setTeamSaving("invite");
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string } & VendorTeamAccessResponse>(
        "/account/vendor-team/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            email: inviteEmail,
            role: inviteRole,
            note: inviteNote || undefined,
          }),
        },
        token,
      );
      setTeamAccess(response);
      setInviteEmail("");
      setInviteRole("employee");
      setInviteNote("");
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to send invite.");
    } finally {
      setTeamSaving(null);
    }
  }

  async function resendInvite(inviteId: string) {
    if (!token) return;
    try {
      setTeamSaving(`resend-${inviteId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string } & VendorTeamAccessResponse>(
        `/account/vendor-team/invitations/${inviteId}/resend`,
        { method: "POST" },
        token,
      );
      setTeamAccess(response);
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to resend invite.");
    } finally {
      setTeamSaving(null);
    }
  }

  async function changeMemberRole(memberId: string, role: VendorAccessRole) {
    if (!token) return;
    try {
      setTeamSaving(`role-${memberId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string } & VendorTeamAccessResponse>(
        `/account/vendor-team/members/${memberId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        },
        token,
      );
      setTeamAccess(response);
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update role.");
    } finally {
      setTeamSaving(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!token || !window.confirm("Remove this person from the shop workspace?")) return;
    try {
      setTeamSaving(`remove-${memberId}`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string } & VendorTeamAccessResponse>(
        `/account/vendor-team/members/${memberId}`,
        { method: "DELETE" },
        token,
      );
      setTeamAccess(response);
      setMessage(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to remove access.");
    } finally {
      setTeamSaving(null);
    }
  }

  if (currentRole === "vendor" && vendorAccessRole === "employee") {
    return (
      <RequireRole requiredRole="vendor">
        <VendorWorkspaceShell
          section="settings"
          eyebrow="Restricted"
          title="Settings access is limited"
          description="Employees can manage products, inventory, and orders, but only a Shop Holder can open shop settings, finance, or team access."
        >
          <div className="message">Only a Shop Holder can manage vendor settings.</div>
        </VendorWorkspaceShell>
      </RequireRole>
    );
  }

  if (loading || !settings) {
    return (
      <RequireRole requiredRole="vendor">
        <div className="message">Loading vendor settings...</div>
      </RequireRole>
    );
  }

  return (
    <RequireRole requiredRole="vendor">
      <VendorWorkspaceShell
        section="settings"
        eyebrow="Configuration"
        title={`${shopName || settings.vendor?.shopName || "Your Shop"} Settings`}
        description="Manage shop information, working hours, low-stock alerts, and seller account configuration."
      >
      <div className="stack account-page">
      <section className="panel hero-panel">
        <span className="chip">Vendor Settings</span>
        <h1 className="hero-title account-hero-title">Manage vendor profile and shop settings.</h1>
        <p className="hero-copy">
          Update your seller account, shop information, branding, policies, and operating details in one place.
        </p>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {!settings.emailVerifiedAt && (
        <div className="inline-actions">
          <button
            className="button-secondary"
            type="button"
            disabled={resendingVerification}
            onClick={() => void resendVerification()}
          >
            {resendingVerification ? "Sending..." : "Resend verification email"}
          </button>
        </div>
      )}

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Account Profile</h2>
          <div className="field">
            <label>Full name</label>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label>Phone number</label>
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />
          </div>
          <button className="button" type="button" disabled={saving} onClick={saveProfile}>
            {saving ? "Saving..." : "Save account details"}
          </button>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Vendor Security</h2>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <button className="button" type="button" disabled={saving} onClick={changePassword}>
            {saving ? "Saving..." : "Change password"}
          </button>
        </div>
      </section>

      <section className="form-card stack">
        <div>
          <h2 className="section-title">Shop Profile</h2>
          <p className="muted">
            Update how your business is represented internally for vendor and admin workflows.
          </p>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Shop name</label>
            <input value={shopName} onChange={(event) => setShopName(event.target.value)} />
          </div>
          <div className="field">
            <label>Support email</label>
            <input value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Support phone</label>
            <input value={supportPhone} onChange={(event) => setSupportPhone(event.target.value)} />
          </div>
          <div className="card">
            <strong>Current shop state</strong>
            <p className="muted">
              {settings.vendor?.shopName || "No shop name yet"}
            </p>
            <p className="muted">
              {settings.vendor?.supportEmail || "No support email"}
            </p>
            <p className="muted">
              {settings.vendor?.supportPhone || "No support phone"}
            </p>
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Shop logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
            <span className="muted">Upload a logo image instead of typing a link.</span>
          </div>
          <div className="field">
            <label>Banner URL</label>
            <input
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
              placeholder="https://example.com/banner.jpg"
            />
          </div>
        </div>
        {(logoPreviewUrl || logoUrl) && (
          <div className="card">
            <strong>Logo preview</strong>
            <div
              style={{
                width: "100%",
                maxWidth: "220px",
                borderRadius: "7px",
                overflow: "hidden",
                border: "1px solid var(--line)",
                background: "#fff",
              }}
            >
              <img
                src={logoPreviewUrl ?? assetUrl(logoUrl)}
                alt="Vendor logo preview"
                style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
              />
            </div>
            {logoFile && <p className="muted">{logoFile.name}</p>}
          </div>
        )}
        <div className="field">
          <label>Shop description</label>
          <textarea
            rows={5}
            value={shopDescription}
            onChange={(event) => setShopDescription(event.target.value)}
            placeholder="Short business summary, service notes, or internal shop profile description"
          />
        </div>
        <div className="field">
          <label>Business address</label>
          <textarea
            rows={3}
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            placeholder="Street, city, postal code, country"
          />
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Business hours</label>
            <textarea
              rows={3}
              value={businessHours}
              onChange={(event) => setBusinessHours(event.target.value)}
              placeholder="Mon-Fri 09:00-18:00, Sat 10:00-14:00"
            />
          </div>
          <div className="field">
            <label>Shipping notes</label>
            <textarea
              rows={3}
              value={shippingNotes}
              onChange={(event) => setShippingNotes(event.target.value)}
              placeholder="Processing time, courier notes, dispatch expectations"
            />
          </div>
        </div>
        <div className="form-grid two">
          <div className="field">
            <label>Low stock alert threshold</label>
            <input
              type="number"
              min={0}
              max={999}
              value={lowStockThreshold}
              onChange={(event) => setLowStockThreshold(event.target.value)}
              placeholder="5"
            />
          </div>
          <div className="card">
            <strong>Stock alert rule</strong>
            <p className="muted">
              Products at or below <strong>{lowStockThreshold || "0"}</strong> units will be marked as low stock and emailed only to your vendor account.
            </p>
            <p className="muted">
              Set this to <strong>0</strong> if you want to turn low stock alerts off.
            </p>
          </div>
        </div>
        <div className="field">
          <label>Return policy</label>
          <textarea
            rows={5}
            value={returnPolicy}
            onChange={(event) => setReturnPolicy(event.target.value)}
            placeholder="Return window, condition requirements, exchange notes"
          />
        </div>
        {(logoUrl || bannerUrl) && (
          <div className="card">
            <strong>Branding status</strong>
            <p className="muted">{logoUrl ? "Logo image stored" : "No logo uploaded yet"}</p>
            <p className="muted">{bannerUrl || "No banner URL"}</p>
          </div>
        )}
        <button className="button" type="button" disabled={saving} onClick={saveVendorProfile}>
          {saving ? "Saving..." : "Save shop profile"}
        </button>
      </section>

      <section className="form-card stack">
        <div>
          <h2 className="section-title">Team Access</h2>
          <p className="muted">
            Invite Shop Holders or Employees, review active access, and manage pending invites for this shop.
          </p>
        </div>

        <div className="form-grid three">
          <div className="field">
            <label>Email</label>
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="employee@shop.com"
            />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as VendorAccessRole)}>
              <option value="employee">Employee</option>
              <option value="shop_holder">Shop Holder</option>
            </select>
          </div>
          <div className="field">
            <label>Note</label>
            <input
              value={inviteNote}
              onChange={(event) => setInviteNote(event.target.value)}
              placeholder="Optional internal note"
            />
          </div>
        </div>
        <div className="inline-actions">
          <button className="button" type="button" disabled={teamSaving !== null} onClick={inviteTeamMember}>
            {teamSaving === "invite" ? "Sending..." : "Invite member"}
          </button>
          <button className="button-ghost" type="button" disabled={teamSaving !== null} onClick={() => void refreshTeamAccess()}>
            Refresh team
          </button>
        </div>

        <div className="stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="section-title">People with access</h3>
            <span className="chip">{teamAccess?.members.length ?? 0}</span>
          </div>
          {teamAccess?.members.length ? teamAccess.members.map((member) => (
            <div key={member.id} className="vendor-team-row">
              <div className="vendor-team-copy">
                <strong>{member.name || member.email}</strong>
                <p className="muted">{member.email}</p>
              </div>
              <div className="vendor-team-meta">
                <span className="chip">{member.role === "shop_holder" ? "Shop Holder" : "Employee"}</span>
                <span className={member.status === "active" ? "badge" : "badge warn"}>
                  {member.status === "active" ? "Active" : "Pending"}
                </span>
                {member.isPrimaryOwner ? <span className="badge">Primary owner</span> : null}
              </div>
              <div className="vendor-team-actions">
                {!member.isPrimaryOwner ? (
                  <>
                    <select
                      value={member.role}
                      onChange={(event) => void changeMemberRole(member.id, event.target.value as VendorAccessRole)}
                      disabled={teamSaving !== null}
                    >
                      <option value="employee">Employee</option>
                      <option value="shop_holder">Shop Holder</option>
                    </select>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={teamSaving !== null}
                      onClick={() => void removeMember(member.id)}
                    >
                      {teamSaving === `remove-${member.id}` ? "Removing..." : "Remove"}
                    </button>
                  </>
                ) : (
                  <span className="muted">Owner access stays fixed.</span>
                )}
              </div>
            </div>
          )) : <div className="empty">Only the primary shop holder has access right now.</div>}
        </div>

        <div className="stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="section-title">Pending invites</h3>
            <span className="chip">{teamAccess?.invites.length ?? 0}</span>
          </div>
          {teamAccess?.invites.length ? teamAccess.invites.map((invite) => (
            <div key={invite.id} className="vendor-team-row">
              <div className="vendor-team-copy">
                <strong>{invite.email}</strong>
                <p className="muted">
                  {invite.role === "shop_holder" ? "Shop Holder" : "Employee"}
                  {invite.note ? ` · ${invite.note}` : ""}
                </p>
              </div>
              <div className="vendor-team-meta">
                <span className="badge warn">Pending</span>
                <span className="muted">Sent {new Date(invite.lastSentAt).toLocaleString()}</span>
              </div>
              <div className="vendor-team-actions">
                <button
                  className="button-ghost"
                  type="button"
                  disabled={teamSaving !== null}
                  onClick={() => void resendInvite(invite.id)}
                >
                  {teamSaving === `resend-${invite.id}` ? "Sending..." : "Resend"}
                </button>
              </div>
            </div>
          )) : <div className="empty">No pending invites.</div>}
        </div>
      </section>

      </div>
      </VendorWorkspaceShell>
    </RequireRole>
  );
}
