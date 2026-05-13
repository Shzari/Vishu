export const passwordPolicyText =
  "Use at least 6 characters with uppercase, lowercase, and a number. Avoid simple sequences like 123 or abc.";

export function getPasswordPolicyError(password: string) {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }

  if (/(123|abc|password)/i.test(password)) {
    return "Avoid simple password sequences like 123, abc, or password.";
  }

  return null;
}
