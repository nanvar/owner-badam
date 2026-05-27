"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileDown,
  Presentation,
  Save,
  Building2,
  Coins,
  Receipt,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";
import {
  upsertPropertyProjectionAction,
  type PropertyProjectionState,
} from "@/app/actions/property-projection";
import { exportProjectionPdf } from "./export-pdf";
import type { Locale } from "@/i18n/config";

export type ProjectionBrand = {
  name: string;
  legalName: string;
  logoDataUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
};

export type ProjectionData = {
  propertyId: string;
  propertyName: string;
  bedrooms: number;
  area: string;
  buildingName: string;
  avgMonthlyNet: number;
  duMonthly: number;
  dewaChillerMonthly: number;
  propertyInsuranceYearly: number;
  maintenanceMonthly: number;
  dtcmPermitYearly: number;
  managementFeePct: number;
  vatPct: number;
  portalFeePct: number;
  pessimisticOccupancy: number;
  realisticOccupancy: number;
  optimisticOccupancy: number;
  pessimisticNet: number;
  realisticNet: number;
  optimisticNet: number;
  listingMgmtBullets: string;
  guestMgmtBullets: string;
  propertyMgmtBullets: string;
  aboutText: string;
};

// Single source of truth for KPI computations. PDF + PPTX exporters
// both call this so the deck and any preview stay in sync.
//
// Admin enters NET annual revenue per scenario; gross is derived by
// inverting the expense formula:
//   net = gross*(1-pp)*(1 - mp*(1+vp)) - utilities
// ⇒  gross = (net + utilities) / [(1-pp) * (1 - mp*(1+vp))]
export function computeScenario(
  net: number,
  data: ProjectionData,
): {
  gross: number;
  portal: number;
  utilities: number;
  managementFee: number;
  vat: number;
  totalExpenses: number;
  net: number;
} {
  const pp = data.portalFeePct / 100;
  const mp = data.managementFeePct / 100;
  const vp = data.vatPct / 100;
  const utilities =
    data.duMonthly * 12 +
    data.dewaChillerMonthly * 12 +
    data.propertyInsuranceYearly +
    data.dtcmPermitYearly +
    data.maintenanceMonthly * 12;
  const denom = (1 - pp) * (1 - mp * (1 + vp));
  const gross = denom > 0 ? (net + utilities) / denom : 0;
  const portal = gross * pp;
  const managementFee = (gross - portal) * mp;
  const vat = managementFee * vp;
  const totalExpenses = portal + utilities + managementFee + vat;
  return { gross, portal, utilities, managementFee, vat, totalExpenses, net };
}

export function ProjectionEditor({
  locale,
  properties,
  initial,
  brand,
}: {
  locale: Locale;
  properties: Array<{ id: string; name: string }>;
  initial: ProjectionData;
  brand: ProjectionBrand;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    PropertyProjectionState | undefined,
    FormData
  >(upsertPropertyProjectionAction, undefined);
  const [data, setData] = useState<ProjectionData>(initial);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (state?.status === "ok") router.refresh();
  }, [state, router]);

  const set = <K extends keyof ProjectionData>(
    key: K,
    value: ProjectionData[K],
  ) => setData((d) => ({ ...d, [key]: value }));
  const setNum = (key: keyof ProjectionData) => (val: string) =>
    set(key, (parseFloat(val) || 0) as never);

  const scenarios = useMemo(
    () => ({
      pessimistic: computeScenario(data.pessimisticNet, data),
      realistic: computeScenario(data.realisticNet, data),
      optimistic: computeScenario(data.optimisticNet, data),
    }),
    [data],
  );

  const handlePdf = async () => {
    setExporting(true);
    try {
      await exportProjectionPdf(data, brand, locale);
    } finally {
      setExporting(false);
    }
  };

  const handlePropertyChange = (id: string) => {
    if (!id || id === data.propertyId) return;
    router.push(`?propertyId=${id}`);
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <Presentation className="h-5 w-5" />
            </span>
            Financial projection
          </span>
        }
        subtitle={
          <select
            value={data.propertyId}
            onChange={(e) => handlePropertyChange(e.target.value)}
            className="mt-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-foreground)] shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              loading={exporting}
              onClick={handlePdf}
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        }
      />

      <form action={action} className="space-y-4">
        <input type="hidden" name="propertyId" value={data.propertyId} />

        {/* Hero / property descriptors */}
        <Card>
          <CardBody className="space-y-4">
            <SectionTitle icon={<Building2 className="h-4 w-4" />}>
              Hero — &ldquo;You could earn …&rdquo;
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Area" htmlFor="area">
                <Input
                  id="area"
                  name="area"
                  value={data.area}
                  onChange={(e) => set("area", e.target.value)}
                  placeholder="Dubai Marina"
                />
              </Field>
              <Field label="Building" htmlFor="buildingName">
                <Input
                  id="buildingName"
                  name="buildingName"
                  value={data.buildingName}
                  onChange={(e) => set("buildingName", e.target.value)}
                  placeholder="Marina Living"
                />
              </Field>
              <Field label="Bedrooms" htmlFor="bedrooms">
                <Input
                  id="bedrooms"
                  name="bedrooms"
                  type="number"
                  min={0}
                  value={String(data.bedrooms)}
                  onChange={(e) =>
                    set("bedrooms", parseInt(e.target.value, 10) || 0)
                  }
                />
              </Field>
            </div>
            <Field label="Average monthly net (AED)" htmlFor="avgMonthlyNet">
              <Input
                id="avgMonthlyNet"
                name="avgMonthlyNet"
                type="number"
                step="0.01"
                min="0"
                value={String(data.avgMonthlyNet || "")}
                onChange={(e) => setNum("avgMonthlyNet")(e.target.value)}
                placeholder="11494"
              />
            </Field>
          </CardBody>
        </Card>

        {/* Monthly costs */}
        <Card>
          <CardBody className="space-y-4">
            <SectionTitle icon={<Receipt className="h-4 w-4" />}>
              Expected costs
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CostInput
                label="Du (Internet) / month"
                name="duMonthly"
                value={data.duMonthly}
                onChange={setNum("duMonthly")}
              />
              <CostInput
                label="DEWA + Chiller / month"
                name="dewaChillerMonthly"
                value={data.dewaChillerMonthly}
                onChange={setNum("dewaChillerMonthly")}
              />
              <CostInput
                label="Property insurance / year"
                name="propertyInsuranceYearly"
                value={data.propertyInsuranceYearly}
                onChange={setNum("propertyInsuranceYearly")}
              />
              <CostInput
                label="Maintenance / month"
                name="maintenanceMonthly"
                value={data.maintenanceMonthly}
                onChange={setNum("maintenanceMonthly")}
              />
              <CostInput
                label="DTCM permit / year"
                name="dtcmPermitYearly"
                value={data.dtcmPermitYearly}
                onChange={setNum("dtcmPermitYearly")}
              />
            </div>
          </CardBody>
        </Card>

        {/* Fees */}
        <Card>
          <CardBody className="space-y-4">
            <SectionTitle icon={<Coins className="h-4 w-4" />}>Fees</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <PercentInput
                label="Management fee %"
                name="managementFeePct"
                value={data.managementFeePct}
                onChange={setNum("managementFeePct")}
              />
              <PercentInput
                label="VAT %"
                name="vatPct"
                value={data.vatPct}
                onChange={setNum("vatPct")}
              />
              <PercentInput
                label="Portal fee %"
                name="portalFeePct"
                value={data.portalFeePct}
                onChange={setNum("portalFeePct")}
              />
            </div>
          </CardBody>
        </Card>

        {/* Scenarios */}
        <Card>
          <CardBody className="space-y-4">
            <SectionTitle icon={<Coins className="h-4 w-4" />}>
              Scenarios
            </SectionTitle>
            <div className="grid gap-3 lg:grid-cols-3">
              <ScenarioBlock
                tone="rose"
                title="Pessimistic"
                occName="pessimisticOccupancy"
                netName="pessimisticNet"
                occ={data.pessimisticOccupancy}
                net={data.pessimisticNet}
                onOcc={setNum("pessimisticOccupancy")}
                onNet={setNum("pessimisticNet")}
                computed={scenarios.pessimistic}
                locale={locale}
              />
              <ScenarioBlock
                tone="sky"
                title="Realistic"
                occName="realisticOccupancy"
                netName="realisticNet"
                occ={data.realisticOccupancy}
                net={data.realisticNet}
                onOcc={setNum("realisticOccupancy")}
                onNet={setNum("realisticNet")}
                computed={scenarios.realistic}
                locale={locale}
              />
              <ScenarioBlock
                tone="emerald"
                title="Optimistic"
                occName="optimisticOccupancy"
                netName="optimisticNet"
                occ={data.optimisticOccupancy}
                net={data.optimisticNet}
                onOcc={setNum("optimisticOccupancy")}
                onNet={setNum("optimisticNet")}
                computed={scenarios.optimistic}
                locale={locale}
              />
            </div>
          </CardBody>
        </Card>

        {/* Static copy overrides */}
        <Card>
          <CardBody className="space-y-4">
            <SectionTitle icon={<Megaphone className="h-4 w-4" />}>
              Service bullets &amp; About (newline = bullet)
            </SectionTitle>
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Listing management" htmlFor="listingMgmtBullets">
                <Textarea
                  id="listingMgmtBullets"
                  name="listingMgmtBullets"
                  rows={6}
                  value={data.listingMgmtBullets}
                  onChange={(e) =>
                    set("listingMgmtBullets", e.target.value)
                  }
                />
              </Field>
              <Field label="Guest management" htmlFor="guestMgmtBullets">
                <Textarea
                  id="guestMgmtBullets"
                  name="guestMgmtBullets"
                  rows={6}
                  value={data.guestMgmtBullets}
                  onChange={(e) => set("guestMgmtBullets", e.target.value)}
                />
              </Field>
              <Field label="Property management" htmlFor="propertyMgmtBullets">
                <Textarea
                  id="propertyMgmtBullets"
                  name="propertyMgmtBullets"
                  rows={6}
                  value={data.propertyMgmtBullets}
                  onChange={(e) =>
                    set("propertyMgmtBullets", e.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="About us paragraph" htmlFor="aboutText">
              <Textarea
                id="aboutText"
                name="aboutText"
                rows={4}
                value={data.aboutText}
                onChange={(e) => set("aboutText", e.target.value)}
              />
            </Field>
          </CardBody>
        </Card>

        {/* Hidden inputs that mirror numeric state — Server action
            reads these. The visible inputs already share `name` but
            numeric coercion happens server-side, so this keeps things
            explicit when controlled state diverges. */}
        <input
          type="hidden"
          name="avgMonthlyNet"
          value={data.avgMonthlyNet}
        />
        <input type="hidden" name="duMonthly" value={data.duMonthly} />
        <input
          type="hidden"
          name="dewaChillerMonthly"
          value={data.dewaChillerMonthly}
        />
        <input
          type="hidden"
          name="propertyInsuranceYearly"
          value={data.propertyInsuranceYearly}
        />
        <input
          type="hidden"
          name="maintenanceMonthly"
          value={data.maintenanceMonthly}
        />
        <input
          type="hidden"
          name="dtcmPermitYearly"
          value={data.dtcmPermitYearly}
        />
        <input
          type="hidden"
          name="managementFeePct"
          value={data.managementFeePct}
        />
        <input type="hidden" name="vatPct" value={data.vatPct} />
        <input type="hidden" name="portalFeePct" value={data.portalFeePct} />
        <input
          type="hidden"
          name="pessimisticOccupancy"
          value={data.pessimisticOccupancy}
        />
        <input
          type="hidden"
          name="realisticOccupancy"
          value={data.realisticOccupancy}
        />
        <input
          type="hidden"
          name="optimisticOccupancy"
          value={data.optimisticOccupancy}
        />
        <input
          type="hidden"
          name="pessimisticNet"
          value={data.pessimisticNet}
        />
        <input
          type="hidden"
          name="realisticNet"
          value={data.realisticNet}
        />
        <input
          type="hidden"
          name="optimisticNet"
          value={data.optimisticNet}
        />

        {state?.status === "error" && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            {state.message}
          </div>
        )}
        {state?.status === "ok" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            Saved.
          </div>
        )}

        <div className="sticky bottom-2 z-10 flex justify-end">
          <Button type="submit" loading={pending}>
            <Save className="h-4 w-4" />
            Save projection
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[var(--color-muted)]">
      <span className="text-[var(--color-brand)]">{icon}</span>
      {children}
    </h2>
  );
}

function CostInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} htmlFor={name}>
      <Input
        id={name}
        name={name}
        type="number"
        step="0.01"
        min="0"
        value={String(value || "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function PercentInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} htmlFor={name}>
      <Input
        id={name}
        name={name}
        type="number"
        step="0.01"
        min="0"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function ScenarioBlock({
  tone,
  title,
  occName,
  netName,
  occ,
  net,
  onOcc,
  onNet,
  computed,
  locale,
}: {
  tone: "rose" | "sky" | "emerald";
  title: string;
  occName: string;
  netName: string;
  occ: number;
  net: number;
  onOcc: (v: string) => void;
  onNet: (v: string) => void;
  computed: ReturnType<typeof computeScenario>;
  locale: Locale;
}) {
  const toneMap: Record<typeof tone, string> = {
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-700",
    sky: "border-sky-500/30 bg-sky-500/5 text-sky-700",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
  };
  return (
    <div className={`rounded-2xl border p-3 ${toneMap[tone]}`}>
      <div className="text-xs font-bold uppercase tracking-wider">{title}</div>
      <div className="mt-3 grid gap-2">
        <Field label="Occupancy %" htmlFor={occName}>
          <Input
            id={occName}
            name={occName}
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={String(occ)}
            onChange={(e) => onOcc(e.target.value)}
          />
        </Field>
        <Field label="Net annual revenue (AED)" htmlFor={netName}>
          <Input
            id={netName}
            name={netName}
            type="number"
            step="0.01"
            min="0"
            value={String(net || "")}
            onChange={(e) => onNet(e.target.value)}
          />
        </Field>
      </div>
      <div className="mt-3 space-y-1 text-xs text-[var(--color-foreground)]/80">
        <Row
          label="Gross annual"
          value={formatCurrency(computed.gross, "AED", locale)}
          strong
        />
        <Row label="Portal fees" value={formatCurrency(computed.portal, "AED", locale)} />
        <Row label="Utilities + permit" value={formatCurrency(computed.utilities, "AED", locale)} />
        <Row label="Management fee" value={formatCurrency(computed.managementFee, "AED", locale)} />
        <Row label="VAT" value={formatCurrency(computed.vat, "AED", locale)} />
        <Row
          label="Total expenses"
          value={formatCurrency(computed.totalExpenses, "AED", locale)}
        />
        <Row
          label="Net annual"
          value={formatCurrency(computed.net, "AED", locale)}
          strong
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className={strong ? "font-bold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}
