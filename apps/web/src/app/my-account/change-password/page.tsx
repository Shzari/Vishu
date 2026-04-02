"use client";

import Link from "next/link";
import { useState } from "react";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";

export default function ChangePasswordPage() {
  const { token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new password confirmation does not match.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await apiRequest(
        "/account/password",
        {
          method: "PATCH",
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        },
        token,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireRole requiredRole="customer">
      <div className="account-focus-page">
        <div className="account-focus-shell">
          <Link href="/account" className="account-focus-back">
            Back to my account
          </Link>

          <section className="account-focus-card">
            <span className="account-section-eyebrow">Change Password</span>
            <h1 className="account-section-title">Keep your account secure</h1>
            <p className="account-section-copy">
              Update your password in one focused step, without mixing it into the rest of your
              account details.
            </p>

            {message ? <div className="message success">{message}</div> : null}
            {error ? <div className="message error">{error}</div> : null}

            <form className="account-stack-form" onSubmit={submitPassword}>
              <div className="field">
                <label>Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="field">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <div className="account-focus-actions">
                <Link href="/account" className="button-secondary">
                  Cancel
                </Link>
                <button type="submit" className="button" disabled={saving}>
                  {saving ? "Saving..." : "Save password"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </RequireRole>
  );
}
