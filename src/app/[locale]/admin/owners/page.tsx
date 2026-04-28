import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { OwnersView } from "./owners-view";

export default async function OwnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const owners = await prisma.user.findMany({
    where: { role: "OWNER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      taxId: true,
      address: true,
      createdAt: true,
      _count: { select: { properties: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <OwnersView
      owners={owners.map((o) => ({
        id: o.id,
        name: o.name,
        email: o.email,
        phone: o.phone,
        taxId: o.taxId,
        address: o.address,
        createdAt: o.createdAt.toISOString(),
        propertyCount: o._count.properties,
      }))}
      labels={{
        title: t("navOwners"),
        newOwner: t("newOwner"),
        createOwner: t("createOwner"),
        editOwner: t("editOwner"),
        ownerEmail: t("ownerEmail"),
        ownerName: t("ownerName"),
        ownerPassword: t("ownerPassword"),
        ownerPhone: t("ownerPhone"),
        ownerTaxId: t("ownerTaxId"),
        ownerAddress: t("ownerAddress"),
        passwordHint: t("passwordHint"),
        deleteOwnerConfirm: t("deleteOwnerConfirm"),
        cancel: tCommon("cancel"),
        delete: tCommon("delete"),
        save: tCommon("save"),
        properties: tCommon("properties"),
        actions: tCommon("actions"),
      }}
    />
  );
}
