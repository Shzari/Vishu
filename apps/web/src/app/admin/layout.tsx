import { AdminWorkspaceFrame } from "@/components/admin-workspace-frame";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminWorkspaceFrame>{children}</AdminWorkspaceFrame>;
}
