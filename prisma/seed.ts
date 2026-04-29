import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

const url = new URL(process.env.DATABASE_URL!);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  }),
});

async function main() {
  await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      brandName: "Badam Owners",
      legalName: "Badam Holiday Homes",
      tagline: "Curated short-term rentals across Dubai.",
      logoUrl: "https://badam.ae/assets/logo-dark.png",
      email: "info@badam.ae",
      phone: "+971 55 644 7293",
      whatsapp: "+971 55 644 7293",
      website: "https://badam.ae",
      address: "Dubai",
      city: "Dubai",
      country: "United Arab Emirates",
      instagram: "https://www.instagram.com/badam_holiday_homes_dubai/",
      facebook: "https://www.facebook.com/badamholidayhomes",
      linkedin: "https://www.linkedin.com/company/badam_holiday_homes_dubai/",
      tiktok: "https://www.tiktok.com/@badam_holidayhomes_dubai",
      youtube: "https://www.youtube.com/@BadamHolidayHomesDubai",
      bookingUrl: "https://book.badam.ae",
      ownerPortal: "https://owners.badam.ae",
      about: "Curated short-term rentals across Dubai — hotel-grade standards, 24/7 support.",
      currency: "AED",
      timezone: "Asia/Dubai",
    },
  });

  const adminPassword = await bcrypt.hash("demo1234", 10);
  const ownerPassword = await bcrypt.hash("demo1234", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { password: adminPassword },
    create: {
      email: "admin@demo.com",
      name: "Demo Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.com" },
    update: {
      password: ownerPassword,
      phone: "+971 50 123 4567",
      taxId: "TC765777558",
      address: "Dubai, United Arab Emirates",
    },
    create: {
      email: "owner@demo.com",
      name: "Yuri Kupalov",
      password: ownerPassword,
      role: "OWNER",
      phone: "+971 50 123 4567",
      taxId: "TC765777558",
      address: "Dubai, United Arab Emirates",
    },
  });

  // Backdate property creation so several full months of reports are testable.
  // Properties exist for ~7 months → 6 completed-month reports plus the current
  // (incomplete) month.
  const now = new Date();
  const propertyCreatedAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1),
  );

  const sampleProperties = [
    { name: "Marina Skyline 2BR", address: "Dubai Marina, Tower A", color: "#6366f1", basePrice: 720, cleaningFee: 180 },
    { name: "Downtown Burj View", address: "Downtown Dubai, Boulevard", color: "#10b981", basePrice: 950, cleaningFee: 220 },
    { name: "JBR Beachfront Studio", address: "JBR Walk", color: "#f59e0b", basePrice: 540, cleaningFee: 150 },
  ];

  const propertyMap: Record<string, string> = {};
  for (const p of sampleProperties) {
    const existing = await prisma.property.findFirst({
      where: { name: p.name, ownerId: owner.id },
    });
    const upserted = existing
      ? await prisma.property.update({
          where: { id: existing.id },
          data: { ...p, createdAt: propertyCreatedAt },
        })
      : await prisma.property.create({
          data: { ...p, ownerId: owner.id, createdAt: propertyCreatedAt },
        });
    propertyMap[p.name] = upserted.id;
  }

  // Build a list of completed months: from property creation up to (now - 1).
  // Months are represented as "YYYY-MM" plus year/monthIndex for date math.
  type Month = { y: number; m: number };
  const completedMonths: Month[] = [];
  {
    let y = propertyCreatedAt.getUTCFullYear();
    let m = propertyCreatedAt.getUTCMonth();
    let endY = now.getUTCFullYear();
    let endM = now.getUTCMonth() - 1;
    if (endM < 0) {
      endM = 11;
      endY -= 1;
    }
    while (y < endY || (y === endY && m <= endM)) {
      completedMonths.push({ y, m });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }

  // Helper: pick a UTC date inside a given month at a specific day.
  const dayInMonth = (mo: Month, day: number) =>
    new Date(Date.UTC(mo.y, mo.m, day, 12, 0, 0));
  const lastDayOfMonth = (mo: Month) =>
    new Date(Date.UTC(mo.y, mo.m + 1, 0)).getUTCDate();

  // Per-property guest pool — cycled through months so seed is deterministic.
  const guestPools: Record<
    string,
    { guest: string; nights: number; price: number; numGuests: number }[]
  > = {
    "Marina Skyline 2BR": [
      { guest: "Ahmed Khalifa", nights: 4, price: 720, numGuests: 2 },
      { guest: "Sarah Müller", nights: 7, price: 740, numGuests: 2 },
      { guest: "Liu Wen", nights: 3, price: 760, numGuests: 1 },
      { guest: "Sophia Bennett", nights: 5, price: 730, numGuests: 3 },
      { guest: "Karim Hassan", nights: 6, price: 745, numGuests: 4 },
      { guest: "Elena Costa", nights: 4, price: 755, numGuests: 2 },
    ],
    "Downtown Burj View": [
      { guest: "Olivia Watts", nights: 6, price: 950, numGuests: 2 },
      { guest: "Mohammed Al-Saud", nights: 4, price: 980, numGuests: 3 },
      { guest: "Helena Petrov", nights: 8, price: 1010, numGuests: 2 },
      { guest: "James Carter", nights: 3, price: 990, numGuests: 2 },
      { guest: "Aiyana Rahman", nights: 5, price: 970, numGuests: 4 },
      { guest: "Pierre Laurent", nights: 4, price: 1000, numGuests: 2 },
    ],
    "JBR Beachfront Studio": [
      { guest: "Nora Ibrahim", nights: 5, price: 540, numGuests: 2 },
      { guest: "Tomás Rivera", nights: 10, price: 560, numGuests: 2 },
      { guest: "Anna Ivanova", nights: 4, price: 580, numGuests: 1 },
      { guest: "Daniel Owen", nights: 6, price: 590, numGuests: 2 },
      { guest: "Mei Tanaka", nights: 3, price: 555, numGuests: 1 },
      { guest: "Hugo Berger", nights: 7, price: 565, numGuests: 2 },
    ],
  };

  // Two reservations per property per completed month, anchored to days 4 and 18.
  const startDays = [4, 18];
  let reservationCount = 0;
  for (const propName of Object.keys(propertyMap)) {
    const propertyId = propertyMap[propName];
    const pool = guestPools[propName];
    let cursor = 0;
    for (let i = 0; i < completedMonths.length; i++) {
      const mo = completedMonths[i];
      for (const startDay of startDays) {
        const sample = pool[cursor % pool.length];
        cursor += 1;
        // Clamp so check-in + nights stays inside calendar bounds.
        const lastDay = lastDayOfMonth(mo);
        const safeStart = Math.min(startDay, Math.max(1, lastDay - sample.nights));
        const checkIn = dayInMonth(mo, safeStart);
        const checkOut = new Date(checkIn);
        checkOut.setUTCDate(checkIn.getUTCDate() + sample.nights);
        const cleaning = sample.price < 700 ? 150 : 200;
        const total = sample.price * sample.nights + cleaning;
        const agencyCommission = Math.round(total * 0.158 * 100) / 100;
        const portalCommission = Math.round(total * 0.18 * 100) / 100;
        const ownerPayout = total - agencyCommission - portalCommission;
        const externalId = `seed-${propName}-${mo.y}-${mo.m + 1}-${startDay}-${sample.guest.replace(/\s/g, "")}`;
        await prisma.reservation.upsert({
          where: { propertyId_externalId: { propertyId, externalId } },
          update: {
            guestName: sample.guest,
            checkIn,
            checkOut,
            nights: sample.nights,
            pricePerNight: sample.price,
            cleaningFee: cleaning,
            totalPrice: total,
            agencyCommission,
            portalCommission,
            payout: ownerPayout,
            currency: "AED",
            detailsFilled: true,
          },
          create: {
            propertyId,
            externalId,
            source: "seed",
            guestName: sample.guest,
            numGuests: sample.numGuests,
            checkIn,
            checkOut,
            nights: sample.nights,
            pricePerNight: sample.price,
            cleaningFee: cleaning,
            totalPrice: total,
            agencyCommission,
            portalCommission,
            payout: ownerPayout,
            currency: "AED",
            detailsFilled: true,
          },
        });
        reservationCount += 1;
      }
    }
  }

  // Per-property expense template — one row per month, rotating type/amount.
  type ExpType =
    | "DEWA"
    | "CHILLER"
    | "DU"
    | "GAS"
    | "CLEANING"
    | "DTCM"
    | "SERVICE_CHARGE"
    | "OTHERS";
  const expensePools: Record<
    string,
    { day: number; type: ExpType; description: string; amount: number }[]
  > = {
    "Marina Skyline 2BR": [
      { day: 5, type: "DEWA", description: "Paid Outstanding DEWA Bill", amount: 2027.85 },
      { day: 8, type: "CHILLER", description: "Paid Outstanding Tasleem Bill", amount: 389.99 },
      { day: 12, type: "DU", description: "du monthly bill", amount: 408.45 },
      { day: 22, type: "CLEANING", description: "Deep furniture cleaning", amount: 292.0 },
    ],
    "Downtown Burj View": [
      { day: 3, type: "SERVICE_CHARGE", description: "Paid Outstanding Service Charges", amount: 5300.45 },
      { day: 9, type: "DTCM", description: "DTCM Registration", amount: 970.0 },
      { day: 15, type: "GAS", description: "Paid Outstanding Gas Bill", amount: 157.5 },
      { day: 26, type: "OTHERS", description: "Send Key to the Owner through Careem Box", amount: 75.46 },
    ],
    "JBR Beachfront Studio": [
      { day: 6, type: "DEWA", description: "Paid Outstanding DEWA Bill", amount: 848.23 },
      { day: 14, type: "CHILLER", description: "Paid Outstanding Tasleem bill", amount: 362.61 },
      { day: 24, type: "DU", description: "du monthly bill", amount: 312.7 },
    ],
  };

  let expenseCount = 0;
  for (const propName of Object.keys(propertyMap)) {
    const propertyId = propertyMap[propName];
    const pool = expensePools[propName];
    let cursor = 0;
    for (const mo of completedMonths) {
      // 1-2 expenses per month, rotating through pool.
      const perMonth = 1 + (cursor % 2);
      for (let k = 0; k < perMonth; k++) {
        const e = pool[cursor % pool.length];
        cursor += 1;
        const safeDay = Math.min(e.day, lastDayOfMonth(mo));
        const date = dayInMonth(mo, safeDay);
        const existing = await prisma.expense.findFirst({
          where: { propertyId, date, type: e.type, description: e.description },
        });
        if (existing) continue;
        await prisma.expense.create({
          data: {
            propertyId,
            date,
            type: e.type,
            description: e.description,
            amount: e.amount,
          },
        });
        expenseCount += 1;
      }
    }
  }

  // One advance every other month for two of the properties.
  let advanceCount = 0;
  const advanceProps = ["Marina Skyline 2BR", "Downtown Burj View"];
  for (const propName of advanceProps) {
    const propertyId = propertyMap[propName];
    for (let idx = 0; idx < completedMonths.length; idx++) {
      if (idx % 2 !== 0) continue;
      const mo = completedMonths[idx];
      const date = dayInMonth(mo, 10);
      const concept = "Payment for Rental";
      const amount = propName === "Marina Skyline 2BR" ? 7362.0 : 5000.0;
      const existing = await prisma.advance.findFirst({
        where: { propertyId, date, concept, amount },
      });
      if (existing) continue;
      await prisma.advance.create({
        data: { propertyId, date, concept, amount },
      });
      advanceCount += 1;
    }
  }

  console.log(
    `Seeded admin=${admin.email}, owner=${owner.email}, properties=${Object.keys(propertyMap).length}, months=${completedMonths.length}, reservations=${reservationCount}, expenses=${expenseCount}, advances=${advanceCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
