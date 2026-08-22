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

// Accounting standardises the cleaning fee at AED 250 per reservation in the
// export (the stored per-booking value is left untouched — display-only and
// feeds the Net formula). Extensions carry no cleaning fee.
const EXPORT_CLEANING_FEE = 250;

const r2 = (n: number) => Math.round(n * 100) / 100;

function cleaningOf(r: ReservationExportRow): number {
  return r.kind === "extension" ? 0 : EXPORT_CLEANING_FEE;
}

// Net owed after fees. Airbnb bookings also carry the portal (channel)
// commission; company (direct) bookings do not.
function netOf(r: ReservationExportRow, mode: "airbnb" | "company"): number {
  const base = r.totalPrice - cleaningOf(r) - r.agencyCommission;
  return r2(mode === "airbnb" ? base - r.portalCommission : base);
}

// Management fee as a share of the total price — shown so the accountant can
// see how the fee was derived, computed dynamically per row.
function mgmtPctOf(r: ReservationExportRow): number {
  return r.totalPrice > 0
    ? Math.round((r.agencyCommission / r.totalPrice) * 1000) / 10
    : 0;
}

// The formula banner shown at the top of each tab, in English for the
// accounting team.
const FORMULA_NOTE: Record<"airbnb" | "company", string> = {
  airbnb:
    "Net = Total price − Portal commission − Cleaning fee − Management fee     •     Management fee % = Management fee ÷ Total price × 100     •     Cleaning fee: AED 250 per reservation (extensions 0).",
  company:
    "Net = Total price − Cleaning fee − Management fee     •     Management fee % = Management fee ÷ Total price × 100     •     Cleaning fee: AED 250 per reservation (extensions 0).",
};

// A money-only column set for the accountant — identity + the figures needed to
// compute VAT and the net. Airbnb tabs add the Portal-commission column (it is
// deducted in the Net); company tabs omit it.
interface Col {
  header: string;
  width: number;
  value: (r: ReservationExportRow) => string | number;
  sum?: boolean; // TOTAL row sums this column
  blended?: boolean; // TOTAL row shows the blended management-fee rate
}

function columnsFor(mode: "airbnb" | "company"): Col[] {
  return [
    { header: "Type", width: 12, value: (r) => (r.kind === "extension" ? "Extension" : "Reservation") },
    { header: "Property", width: 24, value: (r) => r.propertyName },
    { header: "Owner", width: 22, value: (r) => r.ownerName ?? "" },
    { header: "Booking ref", width: 16, value: (r) => r.bookingRef ?? "" },
    { header: "Check-in", width: 12, value: (r) => DATE_FMT.format(new Date(r.checkIn)) },
    { header: "Check-out", width: 12, value: (r) => DATE_FMT.format(new Date(r.checkOut)) },
    { header: "Nights", width: 8, value: (r) => r.nights, sum: true },
    { header: "Total price", width: 13, value: (r) => r.totalPrice, sum: true },
    ...(mode === "airbnb"
      ? [{ header: "Portal commission", width: 16, value: (r: ReservationExportRow) => r.portalCommission, sum: true }]
      : []),
    { header: "Cleaning fee", width: 13, value: (r) => cleaningOf(r), sum: true },
    { header: "Management fee", width: 15, value: (r) => r.agencyCommission, sum: true },
    { header: "Management fee %", width: 16, value: (r) => mgmtPctOf(r), blended: true },
    { header: "Net", width: 14, value: (r) => netOf(r, mode), sum: true },
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
      const book = XLSX.utils.book_new();

      // Split by channel: Airbnb (portal) vs company/direct. Extensions inherit
      // their parent's source, so they land on the same tab as the booking.
      const airbnbRows = rows.filter((r) => r.source.toLowerCase() === "airbnb");
      const companyRows = rows.filter((r) => r.source.toLowerCase() !== "airbnb");

      const buildTab = (tabRows: ReservationExportRow[], mode: "airbnb" | "company") => {
        const cols = columnsFor(mode);
        const sum = (fn: (r: ReservationExportRow) => number) =>
          r2(tabRows.reduce((acc, r) => acc + fn(r), 0));
        const sumTotal = sum((r) => r.totalPrice);
        const sumMgmt = sum((r) => r.agencyCommission);
        const totalRow = cols.map((c) => {
          if (c.header === "Type") return "TOTAL";
          if (c.header === "Property") {
            return `${tabRows.filter((r) => r.kind === "reservation").length} res · ${tabRows.filter((r) => r.kind === "extension").length} ext`;
          }
          if (c.sum) return sum((r) => Number(c.value(r)) || 0);
          if (c.blended) return sumTotal > 0 ? r2((sumMgmt / sumTotal) * 100) : "";
          return "";
        });
        const ws = XLSX.utils.aoa_to_sheet([
          [FORMULA_NOTE[mode]],
          [],
          cols.map((c) => c.header),
          ...tabRows.map((r) => cols.map((c) => c.value(r))),
          ...(tabRows.length > 0 ? [totalRow] : []),
        ]);
        ws["!cols"] = cols.map((c) => ({ wch: c.width }));
        return ws;
      };

      XLSX.utils.book_append_sheet(book, buildTab(companyRows, "company"), "Company reservations");
      XLSX.utils.book_append_sheet(book, buildTab(airbnbRows, "airbnb"), "Airbnb reservations");

      // Owners with their expenses → net total payout (reconciles with the
      // dashboard). Expenses are per property, so they roll up to the owner.
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
