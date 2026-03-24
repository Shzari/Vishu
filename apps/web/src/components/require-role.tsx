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
  children: ReactNode;
}

export function RequireRole({ requiredRole, children }: RequireRoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, profile, loading } = useAuth();
  const currentRole = profile?.role ?? user?.role ?? null;
  const loginPath = loginPathByRole[requiredRole];

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      if (pathname !== loginPath) {
        router.replace(loginPath);
      }
      return;
    }

    if (currentRole && currentRole !== requiredRole) {
      router.replace(homePathByRole[currentRole]);
    }
  }, [currentRole, loading, loginPath, pathname, requiredRole, router, token]);

  if (loading) {
    return <div className="message">Checking your session...</div>;
  }

  if (!token) {
    return <div className="message">Redirecting to sign in...</div>;
  }

  if (currentRole !== requiredRole) {
    return <div className="message">Redirecting to the correct workspace...</div>;
  }

  return <>{children}</>;
}
