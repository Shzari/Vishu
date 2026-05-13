# Vishu Password Reset Email Configuration

Password reset links are sent by the API from `POST /auth/password-reset/request`.

## Current Requirements

- The requested email must already exist in `dbo.users.email`.
- `platform_settings.password_reset_emails_enabled` must be `1`.
- SMTP must be configured either in Admin Settings or API environment variables.
- `APP_BASE_URL` must point to the public web URL, usually `https://vishu.shop`.

## SMTP Settings

For the current Office 365 setup:

```env
APP_BASE_URL=https://vishu.shop
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@vishu.shop
SMTP_PASS=<mailbox app password or SMTP-enabled password>
MAIL_FROM=admin@vishu.shop
```

The app can also store these in Admin > Settings. Environment values can override stored secrets.

## Office 365 Checks

If SMTP verify passes but users do not receive reset emails, check:

- The mailbox has authenticated SMTP enabled.
- The account password is current, or an app password is used if MFA/security defaults require it.
- `MAIL_FROM` matches the authenticated mailbox, or the mailbox has Send As permission.
- Microsoft Defender/Exchange quarantine did not hold the message.
- Junk/spam folders for Hotmail, Gmail, and Outlook recipients.

## Local Verification

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-status.ps1
```

Then request a reset for an existing user email. Check:

```powershell
Get-Content .codex/run-logs/api-local.out.log -Tail 80
Get-Content .codex/run-logs/api-local.err.log -Tail 80
```

Successful SMTP sends log:

```text
Password reset email queued for user@example.com: <message-id>; accepted=...; rejected=...
```

If `accepted` is empty or `rejected` contains the recipient, the mail provider accepted the login but did not accept delivery to that address.

## Important Behavior

For security, reset request responses do not reveal whether an email exists. If the email is misspelled or not in `dbo.users`, the UI still says a reset was sent, but no email is sent.
