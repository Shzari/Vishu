"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type { AccountSettingsProfile, UserRole } from "@/lib/types";

interface AccountSettingsPanelProps {
  allowedRole: UserRole;
  title: string;
  description: string;
  extraContent?: ReactNode;
}

export function AccountSettingsPanel({
  allowedRole,
  title,
  description,
  extraContent,
}: AccountSettingsPanelProps) {
  const { token, currentRole, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<AccountSettingsProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<AccountSettingsProfile>("/account/settings", undefined, token);
      setSettings(data);
      setFullName(data.fullName ?? "");
      setEmail(data.email);
      setPhoneNumber(data.phoneNumber ?? "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && currentRole === allowedRole) {
      void loadSettings();
    }
  }, [allowedRole, currentRole, token]);

  async function saveProfile() {
    if (!token) return;

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
      setMessage("Settings updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update settings.");
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

  if (!token || currentRole !== allowedRole) {
    return <div className="message error">Login with the correct account to manage these settings.</div>;
  }

  if (loading || !settings) {
    return <div className="message">Loading settings...</div>;
  }

  return (
    <div className="stack account-page">
      <section className="panel hero-panel">
        <span className="chip">Account Settings</span>
        <h1 className="hero-title account-hero-title">{title}</h1>
        <p className="hero-copy">{description}</p>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      <section className="split">
        <div className="form-card stack">
          <h2 className="section-title">Profile</h2>
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
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>

        <div className="form-card stack">
          <h2 className="section-title">Security</h2>
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
          <div className="card">
            <strong>Role</strong>
            <p className="muted" style={{ textTransform: "capitalize" }}>{settings.role}</p>
          </div>
          <div className="card">
            <strong>Account created</strong>
            <p className="muted">{new Date(settings.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </section>

      {extraContent}
    </div>
  );
}
