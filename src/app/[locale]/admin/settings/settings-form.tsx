"use client";

import { useActionState } from "react";
import {
  Building2,
  Phone,
  Globe,
  Hash,
  Image as ImageIcon,
  Settings as SettingsIcon,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Field, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/app-shell";
import {
  updateSettingsAction,
  type SettingsState,
} from "@/app/actions/settings";

type Values = {
  brandName: string;
  legalName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  address: string;
  city: string;
  country: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  tiktok: string;
  youtube: string;
  bookingUrl: string;
  ownerPortal: string;
  about: string;
  currency: string;
  timezone: string;
};

export function SettingsForm({
  settings,
  labels,
}: {
  settings: Values;
  labels: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<SettingsState | undefined, FormData>(
    updateSettingsAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-5">
      <PageHeader
        title={labels.title}
        right={
          <Button type="submit" loading={pending}>
            <Check className="h-4 w-4" />
            {labels.save}
          </Button>
        }
      />

      {state?.status === "ok" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          ✓ {labels.saved}
        </div>
      )}
      {state?.status === "error" && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600">
          {state.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <SettingsIcon className="-mt-0.5 mr-1.5 inline h-4 w-4" />
            {labels.sectionBrand}
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.brandName} htmlFor="brandName">
            <Input id="brandName" name="brandName" defaultValue={settings.brandName} required />
          </Field>
          <Field label={labels.legalName} htmlFor="legalName">
            <Input id="legalName" name="legalName" defaultValue={settings.legalName} />
          </Field>
          <Field label={labels.tagline} htmlFor="tagline" hint="Shown on login page">
            <Input id="tagline" name="tagline" defaultValue={settings.tagline} />
          </Field>
          <Field label={labels.logoUrl} htmlFor="logoUrl" hint="Used in header & login">
            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={settings.logoUrl}
                className="pl-9"
                placeholder="https://..."
              />
            </div>
          </Field>
          <Field label={labels.faviconUrl} htmlFor="faviconUrl">
            <Input
              id="faviconUrl"
              name="faviconUrl"
              type="url"
              defaultValue={settings.faviconUrl}
              placeholder="https://..."
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={labels.about} htmlFor="about">
              <Textarea
                id="about"
                name="about"
                defaultValue={settings.about}
                placeholder="Short company description..."
              />
            </Field>
          </div>
          {settings.logoUrl && (
            <div className="sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                {labels.preview}
              </div>
              <div className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.logoUrl}
                  alt={settings.brandName}
                  className="h-10 w-auto object-contain"
                />
                <div>
                  <div className="text-sm font-bold">{settings.brandName}</div>
                  {settings.tagline && (
                    <div className="text-xs text-[var(--color-muted)]">
                      {settings.tagline}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Phone className="-mt-0.5 mr-1.5 inline h-4 w-4" />
            {labels.sectionContact}
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.email} htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={settings.email} />
          </Field>
          <Field label={labels.phone} htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={settings.phone} />
          </Field>
          <Field label={labels.whatsapp} htmlFor="whatsapp">
            <Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsapp} />
          </Field>
          <Field label={labels.website} htmlFor="website">
            <Input
              id="website"
              name="website"
              type="url"
              defaultValue={settings.website}
              placeholder="https://..."
            />
          </Field>
          <Field label={labels.address} htmlFor="address">
            <Input id="address" name="address" defaultValue={settings.address} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={labels.city} htmlFor="city">
              <Input id="city" name="city" defaultValue={settings.city} />
            </Field>
            <Field label={labels.country} htmlFor="country">
              <Input id="country" name="country" defaultValue={settings.country} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Hash className="-mt-0.5 mr-1.5 inline h-4 w-4" />
            {labels.sectionSocial}
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.instagram} htmlFor="instagram">
            <Input id="instagram" name="instagram" type="url" defaultValue={settings.instagram} />
          </Field>
          <Field label={labels.facebook} htmlFor="facebook">
            <Input id="facebook" name="facebook" type="url" defaultValue={settings.facebook} />
          </Field>
          <Field label={labels.linkedin} htmlFor="linkedin">
            <Input id="linkedin" name="linkedin" type="url" defaultValue={settings.linkedin} />
          </Field>
          <Field label={labels.tiktok} htmlFor="tiktok">
            <Input id="tiktok" name="tiktok" type="url" defaultValue={settings.tiktok} />
          </Field>
          <Field label={labels.youtube} htmlFor="youtube">
            <Input id="youtube" name="youtube" type="url" defaultValue={settings.youtube} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Globe className="-mt-0.5 mr-1.5 inline h-4 w-4" />
            {labels.sectionLinks}
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.bookingUrl} htmlFor="bookingUrl">
            <Input id="bookingUrl" name="bookingUrl" type="url" defaultValue={settings.bookingUrl} />
          </Field>
          <Field label={labels.ownerPortal} htmlFor="ownerPortal">
            <Input
              id="ownerPortal"
              name="ownerPortal"
              type="url"
              defaultValue={settings.ownerPortal}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Building2 className="-mt-0.5 mr-1.5 inline h-4 w-4" />
            {labels.sectionRegional}
          </CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.currency} htmlFor="currency" hint="ISO code, e.g. AED, USD">
            <Input id="currency" name="currency" defaultValue={settings.currency} />
          </Field>
          <Field label={labels.timezone} htmlFor="timezone" hint="IANA, e.g. Asia/Dubai">
            <Input id="timezone" name="timezone" defaultValue={settings.timezone} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} size="lg">
          <Check className="h-4 w-4" />
          {labels.save}
        </Button>
      </div>
    </form>
  );
}
