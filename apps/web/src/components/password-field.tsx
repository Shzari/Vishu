"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

export function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <div className="password-input-wrap">
      <input
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="password-eye-button"
        aria-label={label}
        title={label}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M2.3 12s3.4-6.1 9.7-6.1S21.7 12 21.7 12s-3.4 6.1-9.7 6.1S2.3 12 2.3 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.9A10.5 10.5 0 0 1 12 5.8c6.3 0 9.7 6.2 9.7 6.2a18.7 18.7 0 0 1-3 3.8" />
      <path d="M14.1 14.2A3 3 0 0 1 9.8 9.9" />
      <path d="M6.5 6.9A18.5 18.5 0 0 0 2.3 12s3.4 6.1 9.7 6.1c1.6 0 3-.4 4.2-1" />
    </svg>
  );
}
