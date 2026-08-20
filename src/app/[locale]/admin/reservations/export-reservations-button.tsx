"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listReservationsForExportAction,
  listOwnerExpenseSummaryAction,
  type ReservationExportRow,
  type OwnerExpenseSummaryRow,
} from "@/app/actions/reservation-export";

// Dates land in the sheet as MM/DD/YYYY (US format) in the property timezone,
// per the accounting team's reporting convention.
const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Dubai",
});

const HEADERS = [
  "Type",
  "Property",
  "Owner",
  "Booking ref",
  "Source",
  "Status",
  "Guest",
  "Phone",
  "Email",
  "Guests",
  "Check-in",
  "Check-out",
  "Nights",
  "Price / night",
  "Cleaning fee",
  "Management fee",
  "Portal commission",
  "Service fee",
  "Taxes",
  "Total price",
  "Owner payout",
  "Currency",
  "Paid",
  "Billing month",
  "In report",
  "Notes",
];

const COLUMN_WIDTHS = [
  12, 24, 22, 16, 10, 12, 24, 16, 26, 8, 12, 12, 8, 13, 13, 18, 18, 12, 10, 12,
  14, 10, 8, 14, 10, 40,
];

function toSheetRow(r: ReservationExportRow) {
  return [
    r.kind === "extension" ? "Extension" : "Reservation",
    r.propertyName,
    r.ownerName ?? "",
    r.bookingRef ?? "",
    r.source,
    r.status,
    r.guestName ?? "",
    r.guestPhone ?? "",
    r.guestEmail ?? "",
    r.numGuests ?? "",
    DATE_FMT.format(new Date(r.checkIn)),
    DATE_FMT.format(new Date(r.checkOut)),
    r.nights,
    Math.round(r.pricePerNight * 100) / 100,
    r.cleaningFee,
    r.agencyCommission,
    r.portalCommission,
    r.serviceFee,
    r.taxes,
    r.totalPrice,
    r.payout,
    r.currency,
    r.paid ? "Yes" : "No",
    r.monthKey ?? "",
    r.reported ? "Yes" : "No",
    r.notes ?? "",
  ];
}

export function ExportReservationsButton({ label }: { label?: string }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      const [rows, owners] = await Promise.all([
        listReservationsForExportAction(),
        listOwnerExpenseSummaryAction(),
      ]);
      const XLSX = await import("xlsx");

      const sum = (pick: (r: ReservationExportRow) => number) =>
        rows.reduce((acc, r) => acc + pick(r), 0);
      // Totals mirror the numeric columns so the sheet closes with a
      // ledger-style summary line.
      const totals = [
        "TOTAL",
        `${rows.filter((r) => r.kind === "reservation").length} reservations · ${rows.filter((r) => r.kind === "extension").length} extensions`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        sum((r) => r.nights),
        "",
        sum((r) => r.cleaningFee),
        sum((r) => r.agencyCommission),
        sum((r) => r.portalCommission),
        sum((r) => r.serviceFee),
        sum((r) => r.taxes),
        sum((r) => r.totalPrice),
        sum((r) => r.payout),
        "",
        "",
        "",
        "",
        "",
      ];

      const sheet = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ...rows.map(toSheetRow),
        ...(rows.length > 0 ? [totals] : []),
      ]);
      sheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Reservations");

      // Second sheet — owners with their expenses. Expenses are recorded per
      // property, not per booking, so they live here as an owner roll-up:
      // payout − expenses = net total payout (reconciles with the dashboard).
      const ownerSum = (pick: (o: OwnerExpenseSummaryRow) => number) =>
        owners.reduce((acc, o) => acc + pick(o), 0);
      const ownerSheet = XLSX.utils.aoa_to_sheet([
        ["Owner", "Properties", "Owner payout", "Owner expenses", "Net total payout"],
        ...owners.map((o) => [o.ownerName, o.properties, o.payout, o.expenses, o.net]),
        ...(owners.length > 0
          ? [[
              "TOTAL",
              ownerSum((o) => o.properties),
              ownerSum((o) => o.payout),
              ownerSum((o) => o.expenses),
              ownerSum((o) => o.net),
            ]]
          : []),
      ]);
      ownerSheet["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(book, ownerSheet, "Owners & expenses");

      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(book, `reservations-${stamp}.xlsx`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" loading={busy} onClick={onClick}>
      <Download className="h-4 w-4" />
      {label ?? "Export"}
    </Button>
  );
}
