import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function AdminIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await requireRole("ADMIN");
  redirect(
    session.role === "SUPERADMIN"
      ? `/${locale}/admin/company`
      : `/${locale}/admin/owners`,
  );
}
