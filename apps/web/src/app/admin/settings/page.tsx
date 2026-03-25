"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers";
import { AccountSettingsPanel } from "@/components/account-settings-panel";
import { RequireRole } from "@/components/require-role";
import { apiRequest } from "@/lib/api";
import type { AdminPlatformSettings } from "@/lib/types";

export default function AdminSettingsPage() {
  const { token, currentRole } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [loadingPlatform, setLoadingPlatform] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [platformMessage, setPlatformMessage] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [activityLog, setActivityLog] = useState<AdminPlatformSettings["activityLog"]>([]);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("2525");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false);
  const [mailFrom, setMailFrom] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState("");
  const [vendorVerificationEmailsEnabled, setVendorVerificationEmailsEnabled] = useState(true);
  const [adminVendorApprovalEmailsEnabled, setAdminVendorApprovalEmailsEnabled] = useState(true);
  const [passwordResetEmailsEnabled, setPasswordResetEmailsEnabled] = useState(true);
  const [smtpPasswordConfigured, setSmtpPasswordConfigured] = useState(false);

  useEffect(() => {
    if (!token || currentRole !== "admin") {
      return;
    }

    let active = true;

    async function loadPlatformSettings() {
      try {
        setLoadingPlatform(true);
        setPlatformError(null);
        const response = await apiRequest<AdminPlatformSettings>("/admin/platform-settings", {}, token);
        if (!active) return;

        setSmtpHost(response.email.smtpHost ?? "");
        setSmtpPort(response.email.smtpPort ? String(response.email.smtpPort) : "2525");
        setSmtpSecure(response.email.smtpSecure);
        setSmtpUser(response.email.smtpUser ?? "");
        setMailFrom(response.email.mailFrom ?? "");
        setAppBaseUrl(response.email.appBaseUrl ?? window.location.origin);
        setVendorVerificationEmailsEnabled(response.email.vendorVerificationEmailsEnabled);
        setAdminVendorApprovalEmailsEnabled(response.email.adminVendorApprovalEmailsEnabled);
        setPasswordResetEmailsEnabled(response.email.passwordResetEmailsEnabled);
        setSmtpPasswordConfigured(response.email.smtpPasswordConfigured);
        setActivityLog(response.activityLog);
      } catch (loadError) {
        if (!active) return;
        setPlatformError(loadError instanceof Error ? loadError.message : "Failed to load platform email settings.");
      } finally {
        if (active) {
          setLoadingPlatform(false);
        }
      }
    }

    void loadPlatformSettings();

    return () => {
      active = false;
    };
  }, [currentRole, token]);

  async function createAdmin() {
    if (!token) return;

    try {
      setSavingAdmin(true);
      setAdminMessage(null);
      setAdminError(null);
      const response = await apiRequest<{ message: string; admin: { email: string } }>(
        "/admin/admins",
        {
          method: "POST",
          body: JSON.stringify({
            fullName: fullName || undefined,
            email,
            phoneNumber: phoneNumber || undefined,
            password,
          }),
        },
        token,
      );

      setFullName("");
      setEmail("");
      setPhoneNumber("");
      setPassword("");
      setAdminMessage(`${response.message}: ${response.admin.email}`);
    } catch (saveError) {
      setAdminError(saveError instanceof Error ? saveError.message : "Failed to create admin.");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function savePlatformSettings() {
    if (!token) return;

    try {
      setSavingPlatform(true);
      setPlatformMessage(null);
      setPlatformError(null);
      const response = await apiRequest<AdminPlatformSettings>(
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

      setSmtpPassword("");
      setClearSmtpPassword(false);
      setSmtpPasswordConfigured(response.email.smtpPasswordConfigured);
      setActivityLog(response.activityLog);
      setPlatformMessage("Platform email settings saved.");
    } catch (saveError) {
      setPlatformError(saveError instanceof Error ? saveError.message : "Failed to save platform email settings.");
    } finally {
      setSavingPlatform(false);
    }
  }

  async function sendTestEmail() {
    if (!token || !testEmailRecipient.trim()) return;

    try {
      setSendingTestEmail(true);
      setPlatformMessage(null);
      setPlatformError(null);
      const response = await apiRequest<{ message: string }>(
        "/admin/platform-settings/test-email",
        {
          method: "POST",
          body: JSON.stringify({ email: testEmailRecipient.trim() }),
        },
        token,
      );
      setPlatformMessage(response.message);
    } catch (sendError) {
      setPlatformError(sendError instanceof Error ? sendError.message : "Failed to send test email.");
    } finally {
      setSendingTestEmail(false);
    }
  }

  const extraContent =
    currentRole === "admin" ? (
      <>
        <section className="form-card stack">
          <div>
            <h2 className="section-title">Homepage Promotions</h2>
            <p className="muted">
              Hero banner management now lives in the dedicated Promotions
              section so uploads, schedules, ordering, and activation stay in
              one place.
            </p>
          </div>
          <div className="inline-actions">
            <Link className="button" href="/admin/promotions">
              Open promotions
            </Link>
          </div>
        </section>

        <section className="form-card stack">
          <div>
            <h2 className="section-title">Platform Email Settings</h2>
            <p className="muted">
              Save Mailtrap or SMTP settings here so admin can control verification emails, reset emails, and future platform mail tools from one place.
            </p>
          </div>

          {platformMessage && <div className="message success">{platformMessage}</div>}
          {platformError && <div className="message error">{platformError}</div>}

          {loadingPlatform ? (
            <div className="message">Loading platform email settings...</div>
          ) : (
            <>
              <div className="form-grid two">
                <div className="field">
                  <label>SMTP host</label>
                  <input value={smtpHost} onChange={(event) => setSmtpHost(event.target.value)} placeholder="sandbox.smtp.mailtrap.io" />
                </div>
                <div className="field">
                  <label>SMTP port</label>
                  <input inputMode="numeric" value={smtpPort} onChange={(event) => setSmtpPort(event.target.value)} placeholder="2525" />
                </div>
                <div className="field">
                  <label>SMTP username</label>
                  <input value={smtpUser} onChange={(event) => setSmtpUser(event.target.value)} placeholder="Mailtrap username" />
                </div>
                <div className="field">
                  <label>SMTP password</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={(event) => setSmtpPassword(event.target.value)}
                    placeholder={smtpPasswordConfigured ? "Leave blank to keep current password" : "Paste SMTP password"}
                  />
                </div>
                <div className="field">
                  <label>Mail from</label>
                  <input value={mailFrom} onChange={(event) => setMailFrom(event.target.value)} placeholder="noreply@vishu.shop" />
                </div>
                <div className="field">
                  <label>App base URL</label>
                  <input value={appBaseUrl} onChange={(event) => setAppBaseUrl(event.target.value)} placeholder="https://vishu.shop" />
                </div>
              </div>

              <div className="form-grid two">
                <label className="checkbox-row">
                  <input type="checkbox" checked={smtpSecure} onChange={(event) => setSmtpSecure(event.target.checked)} />
                  <span>Use secure SMTP connection</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={clearSmtpPassword}
                    onChange={(event) => setClearSmtpPassword(event.target.checked)}
                  />
                  <span>Clear stored SMTP password</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={vendorVerificationEmailsEnabled}
                    onChange={(event) => setVendorVerificationEmailsEnabled(event.target.checked)}
                  />
                  <span>Send vendor verification emails</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={adminVendorApprovalEmailsEnabled}
                    onChange={(event) => setAdminVendorApprovalEmailsEnabled(event.target.checked)}
                  />
                  <span>Send admin approval notification emails</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={passwordResetEmailsEnabled}
                    onChange={(event) => setPasswordResetEmailsEnabled(event.target.checked)}
                  />
                  <span>Send password reset emails</span>
                </label>
              </div>

              <div className="card">
                <strong>Email controls</strong>
                <p className="muted">
                  Stored password: {smtpPasswordConfigured ? "configured" : "not saved yet"}.
                  This section is reserved for SMTP, app links, and future platform operations settings.
                </p>
              </div>

              <div className="form-grid two">
                <div className="field">
                  <label>Send test email to</label>
                  <input
                    value={testEmailRecipient}
                    onChange={(event) => setTestEmailRecipient(event.target.value)}
                    placeholder="your-inbox@example.com"
                  />
                </div>
              </div>

              <div className="inline-actions">
                <button className="button" type="button" disabled={savingPlatform} onClick={() => void savePlatformSettings()}>
                  {savingPlatform ? "Saving..." : "Save platform email settings"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={sendingTestEmail || !testEmailRecipient.trim()}
                  onClick={() => void sendTestEmail()}
                >
                  {sendingTestEmail ? "Sending..." : "Send test email"}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="form-card stack">
          <div>
            <h2 className="section-title">Recent Admin Activity</h2>
            <p className="muted">Trace the latest admin-side changes to approvals, settings, resets, and other platform actions.</p>
          </div>

          {loadingPlatform ? (
            <div className="message">Loading admin activity...</div>
          ) : activityLog.length === 0 ? (
            <div className="message">No admin activity has been recorded yet.</div>
          ) : (
            <div className="stack">
              {activityLog.map((entry) => (
                <div key={entry.id} className="card">
                  <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <strong>{entry.description}</strong>
                      <p className="muted">
                        {entry.adminEmail} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.entityLabel ? (
                        <p className="muted">
                          {entry.entityType}: {entry.entityLabel}
                        </p>
                      ) : null}
                    </div>
                    <span className="chip">{entry.actionType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="form-card stack">
          <div>
            <h2 className="section-title">Add Another Admin</h2>
            <p className="muted">Create a separate admin login for a teammate who should manage operations.</p>
          </div>

          {adminMessage && <div className="message success">{adminMessage}</div>}
          {adminError && <div className="message error">{adminError}</div>}

          <div className="form-grid two">
            <div className="field">
              <label>Full name</label>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Operations manager" />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@company.com" />
            </div>
            <div className="field">
              <label>Phone number</label>
              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+383 ..." />
            </div>
            <div className="field">
              <label>Temporary password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" />
            </div>
          </div>

          <div className="inline-actions">
            <button className="button" type="button" disabled={savingAdmin} onClick={() => void createAdmin()}>
              {savingAdmin ? "Creating..." : "Create admin account"}
            </button>
          </div>
        </section>
      </>
    ) : null;

  return (
    <RequireRole requiredRole="admin">
      <AccountSettingsPanel
        allowedRole="admin"
        title="Manage your admin account settings."
        description="Keep your admin contact details and password up to date, and add other admins when you need more operational help."
        extraContent={extraContent}
      />
    </RequireRole>
  );
}
