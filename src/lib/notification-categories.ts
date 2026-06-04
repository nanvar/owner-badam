// Single source of truth describing every NotificationType users
// can opt out of. Both the dispatcher (notify()) and the settings UI
// read from this file so adding a new event only requires:
//   1. New key in NotificationType (lib/notify.ts)
//   2. A row here describing it
//   3. Call notify({type: NEW_TYPE, …}) where it fires.

import {
  NotificationType,
  type NotificationTypeKey,
} from "./notification-types";

export type NotificationGroup =
  | "bookings"
  | "expenses"
  | "payments"
  | "property"
  | "owner-debts"
  | "stay";

export type NotificationCategory = {
  type: NotificationTypeKey;
  label: string;
  description: string;
  group: NotificationGroup;
  // Default ON unless the user explicitly muted it.
  defaultOn: boolean;
};

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  bookings: "Bookings",
  expenses: "Expenses",
  payments: "Payments",
  property: "Property updates",
  "owner-debts": "Owner debts",
  stay: "Owner stays",
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  // ---- Bookings
  {
    type: NotificationType.NEW_RESERVATION,
    group: "bookings",
    label: "New reservation",
    description: "A guest booked your property (via Airbnb sync or manual).",
    defaultOn: true,
  },
  {
    type: NotificationType.RESERVATION_PAID,
    group: "bookings",
    label: "Reservation paid",
    description: "A booking just transitioned to paid.",
    defaultOn: true,
  },
  {
    type: NotificationType.CHECK_IN_TODAY,
    group: "bookings",
    label: "Check-in today",
    description: "Reminder that a guest is checking in today.",
    defaultOn: true,
  },
  {
    type: NotificationType.CHECK_OUT_TODAY,
    group: "bookings",
    label: "Check-out today",
    description: "Reminder that a guest is checking out today.",
    defaultOn: true,
  },
  // ---- Expenses
  {
    type: NotificationType.NEW_EXPENSE,
    group: "expenses",
    label: "New expense",
    description: "Management logged a new expense on your property.",
    defaultOn: true,
  },
  // ---- Payments
  {
    type: NotificationType.OWNER_PAYMENT_RECORDED,
    group: "payments",
    label: "Payment recorded",
    description: "Management recorded a payout to you.",
    defaultOn: true,
  },
  {
    type: NotificationType.NEW_REPORT,
    group: "payments",
    label: "New report",
    description: "A new settlement report is ready to review.",
    defaultOn: true,
  },
  // ---- Property updates
  {
    type: NotificationType.PROPERTY_EVENT,
    group: "property",
    label: "Property event",
    description: "Renovations, inspections, condition notes…",
    defaultOn: true,
  },
  {
    type: NotificationType.PROPERTY_DOCUMENT_UPLOADED,
    group: "property",
    label: "Document uploaded",
    description: "A new document was attached to your property.",
    defaultOn: true,
  },
  {
    type: NotificationType.SERVICE_CHARGE_DUE,
    group: "property",
    label: "Service charge due (daily)",
    description:
      "Daily nudge when your service-charge bill is in the reminder window.",
    defaultOn: true,
  },
  {
    type: NotificationType.SERVICE_CHARGE_PAID,
    group: "property",
    label: "Service charge paid",
    description: "Management filed payment on a service-charge bill.",
    defaultOn: true,
  },
  // ---- Owner debts
  {
    type: NotificationType.OWNER_DEBT_CREATED,
    group: "owner-debts",
    label: "New debt logged",
    description:
      "Management paid an expense from invested capital — you now owe it.",
    defaultOn: true,
  },
  {
    type: NotificationType.OWNER_DEBT_SETTLED,
    group: "owner-debts",
    label: "Debt settled",
    description: "A previously open debt was marked paid.",
    defaultOn: true,
  },
  // ---- Owner stays
  {
    type: NotificationType.STAY_REQUEST_APPROVED,
    group: "stay",
    label: "Stay request approved",
    description: "Your owner stay request was approved.",
    defaultOn: true,
  },
  {
    type: NotificationType.STAY_REQUEST_REJECTED,
    group: "stay",
    label: "Stay request rejected",
    description: "Your owner stay request was rejected — note in app.",
    defaultOn: true,
  },
];

// Convert stored prefs JSON to a fully-realised map. Missing keys
// fall back to their `defaultOn` setting so the UI never has to
// special-case "not set".
export function resolveNotificationPrefs(
  raw: unknown,
): Record<NotificationTypeKey, boolean> {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<NotificationTypeKey, boolean>;
  for (const cat of NOTIFICATION_CATEGORIES) {
    const v = obj[cat.type];
    if (v === false) out[cat.type] = false;
    else if (v === true) out[cat.type] = true;
    else out[cat.type] = cat.defaultOn;
  }
  return out;
}
