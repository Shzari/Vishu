"use client";

import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { VendorWorkspace } from "@/components/vendor-workspace";
import { VendorWorkspaceShell } from "@/components/vendor-workspace-shell";

export default function VendorEarningsPage() {
  const { profile } = useAuth();

  if (profile?.vendor?.access_role === "employee") {
    return (
      <RequireRole requiredRole="vendor">
        <VendorWorkspaceShell
          section="earnings"
          eyebrow="Restricted"
          title="Finance access is limited"
          description="Only a Shop Holder can open earnings, payouts, and revenue performance."
        >
          <div className="message">Only a Shop Holder can view earnings.</div>
        </VendorWorkspaceShell>
      </RequireRole>
    );
  }

  return <VendorWorkspace section="earnings" />;
}
