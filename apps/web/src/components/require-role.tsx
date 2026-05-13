"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import type { UserRole } from "@/lib/types";

const loginPathByRole: Record<UserRole, string> = {
  admin: "/admin/login",
  vendor: "/login",
  customer: "/login",
};

const homePathByRole: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  vendor: "/vendor/dashboard",
  customer: "/",
};

interface RequireRoleProps {
  requiredRole: UserRole;
  allowedRoles?: UserRole[];
  children: ReactNode;
}

export function RequireRole({ requiredRole, allowedRoles, children }: RequireRoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, profile, loading } = useAuth();
  const currentRole = profile?.role ?? user?.role ?? null;
  const loginPath = loginPathByRole[requiredRole];
  const acceptedRoles = allowedRoles ?? [requiredRole];

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      if (pathname !== loginPath) {
        const nextPath = encodeURIComponent(pathname);
        router.replace(`${loginPath}?next=${nextPath}`);
      }
      return;
    }

    if (currentRole && !acceptedRoles.includes(currentRole)) {
      router.replace(homePathByRole[currentRole]);
    }
  }, [acceptedRoles, currentRole, loading, loginPath, pathname, requiredRole, router, token]);

  // Keep mounted pages alive during background auth refreshes; unmounting clears file inputs.
  if (loading && (!token || !currentRole)) {
    return <div className="message">Checking your session...</div>;
  }

  if (!token) {
    return <div className="message">Redirecting to sign in...</div>;
  }

  if (!currentRole || !acceptedRoles.includes(currentRole)) {
    return <div className="message">Redirecting to the correct workspace...</div>;
  }

  return <>{children}</>;
}
