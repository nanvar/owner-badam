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

// Accounting standardises the cleaning fee at AED 250 for every row in the
// export (the stored per-booking value is left untouched — this is display-only
// and feeds the Net formula below).
const EXPORT_CLEANING_FEE = 250;

const r2 = (n: number) => Math.round(n * 100) / 100;

// Net owed after fees. Airbnb bookings also carry the portal (channel)
// commission; company (direct) bookings do not.
function netOf(r: ReservationExportRow, mode: "airbnb" | "company"): number {
  const base = r.totalPrice - EXPORT_CLEANING_FEE - r.agencyCommission;
  return r2(mode === "airbnb" ? base - r.portalCommission : base);
}

// Management fee as a share of the total price — shown so the accountant can
// see how the fee was derived, computed dynamically per row.
function mgmtPctOf(r: ReservationExportRow): number {
  return r.totalPrice > 0
    ? Math.round((r.agencyCommission / r.totalPrice) * 1000) / 10
    : 0;
}

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
  "Management fee %",
  "Portal commission",
  "Service fee",
  "Taxes",
  "Total price",
  "Net",
  "Owner payout",
  "Currency",
  "Paid",
  "Billing month",
  "In report",
  "Notes",
];

const COLUMN_WIDTHS = [
  12, 24, 22, 16, 10, 12, 24, 16, 26, 8, 12, 12, 8, 13, 13, 15, 16, 18, 12, 10,
  13, 14, 14, 10, 8, 14, 10, 40,
];

// The formula banner shown at the top of each reservations tab, in English for
// the accounting team.
const FORMULA_NOTE: Record<"airbnb" | "company", string> = {
  airbnb:
    "Formula:  Net = Total price − Portal commission − Cleaning fee − Management fee     •     Management fee % = Management fee ÷ Total price × 100     •     Cleaning fee is fixed at AED 250 in this export.",
  company:
    "Formula:  Net = Total price − Cleaning fee − Management fee     •     Management fee % = Management fee ÷ Total price × 100     •     Cleaning fee is fixed at AED 250 in this export.",
};

function toSheetRow(r: ReservationExportRow, mode: "airbnb" | "company") {
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
    r2(r.pricePerNight),
    EXPORT_CLEANING_FEE,
    r.agencyCommission,
    mgmtPctOf(r),
    r.portalCommission,
    r.serviceFee,
    r.taxes,
    r.totalPrice,
    netOf(r, mode),
    r.payout,
    r.currency,
    r.paid ? "Yes" : "No",
    r.monthKey ?? "",
    r.reported ? "Yes" : "No",
    r.notes ?? "",
  ];
}

// Ledger-style TOTAL line — sums the numeric columns; Management fee % shows the
// blended rate (total fee ÷ total price) rather than a meaningless column sum.
function totalsRow(tabRows: ReservationExportRow[], mode: "airbnb" | "company") {
  const sum = (pick: (r: ReservationExportRow) => number) =>
    r2(tabRows.reduce((acc, r) => acc + pick(r), 0));
  const sumTotal = sum((r) => r.totalPrice);
  const sumMgmt = sum((r) => r.agencyCommission);
  const t: (string | number)[] = new Array(HEADERS.length).fill("");
  t[0] = "TOTAL";
  t[1] = `${tabRows.filter((r) => r.kind === "reservation").length} reservations · ${tabRows.filter((r) => r.kind === "extension").length} extensions`;
  t[12] = sum((r) => r.nights);
  t[14] = r2(EXPORT_CLEANING_FEE * tabRows.length);
  t[15] = sumMgmt;
  t[16] = sumTotal > 0 ? r2((sumMgmt / sumTotal) * 100) : "";
  t[17] = sum((r) => r.portalCommission);
  t[18] = sum((r) => r.serviceFee);
  t[19] = sum((r) => r.taxes);
  t[20] = sumTotal;
  t[21] = r2(tabRows.reduce((acc, r) => acc + netOf(r, mode), 0));
  t[22] = sum((r) => r.payout);
  return t;
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
      const book = XLSX.utils.book_new();

      // Split by channel: Airbnb (portal) vs company/direct. Extensions inherit
      // their parent's source, so they land on the same tab as the booking.
      const airbnbRows = rows.filter((r) => r.source.toLowerCase() === "airbnb");
      const companyRows = rows.filter((r) => r.source.toLowerCase() !== "airbnb");

      const buildTab = (
        tabRows: ReservationExportRow[],
        mode: "airbnb" | "company",
      ) => {
        const ws = XLSX.utils.aoa_to_sheet([
          [FORMULA_NOTE[mode]],
          [],
          HEADERS,
          ...tabRows.map((r) => toSheetRow(r, mode)),
          ...(tabRows.length > 0 ? [totalsRow(tabRows, mode)] : []),
        ]);
        ws["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));
        return ws;
      };

      XLSX.utils.book_append_sheet(
        book,
        buildTab(companyRows, "company"),
        "Company reservations",
      );
      XLSX.utils.book_append_sheet(
        book,
        buildTab(airbnbRows, "airbnb"),
        "Airbnb reservations",
      );

      // Owners with their expenses. Expenses are recorded per property, not per
      // booking, so they live here as an owner roll-up: payout − expenses = net
      // total payout (reconciles with the dashboard).
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
