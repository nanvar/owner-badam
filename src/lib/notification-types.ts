// Stable type-tag constants for the notification system. Lives in
// its own file (no prisma / no server deps) so client components
// like the settings form can import NotificationType without
// dragging the server-side dispatcher's transitive imports into the
// browser bundle.

export const NotificationType = {
  NEW_RESERVATION: "NEW_RESERVATION",
  RESERVATION_PAID: "RESERVATION_PAID",
  CHECK_IN_TODAY: "CHECK_IN_TODAY",
  CHECK_OUT_TODAY: "CHECK_OUT_TODAY",
  NEW_EXPENSE: "NEW_EXPENSE",
  PROPERTY_EVENT: "PROPERTY_EVENT",
  PROPERTY_DOCUMENT_UPLOADED: "PROPERTY_DOCUMENT_UPLOADED",
  NEW_REPORT: "NEW_REPORT",
  OWNER_PAYMENT_RECORDED: "OWNER_PAYMENT_RECORDED",
  SERVICE_CHARGE_DUE: "SERVICE_CHARGE_DUE",
  SERVICE_CHARGE_PAID: "SERVICE_CHARGE_PAID",
  OWNER_DEBT_CREATED: "OWNER_DEBT_CREATED",
  OWNER_DEBT_SETTLED: "OWNER_DEBT_SETTLED",
  STAY_REQUEST_APPROVED: "STAY_REQUEST_APPROVED",
  STAY_REQUEST_REJECTED: "STAY_REQUEST_REJECTED",
} as const;

export type NotificationTypeKey =
  (typeof NotificationType)[keyof typeof NotificationType];
