import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
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
    update: { password: ownerPassword },
    create: {
      email: "owner@demo.com",
      name: "Demo Owner",
      password: ownerPassword,
      role: "OWNER",
    },
  });

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
      ? await prisma.property.update({ where: { id: existing.id }, data: p })
      : await prisma.property.create({
          data: { ...p, ownerId: owner.id },
        });
    propertyMap[p.name] = upserted.id;
  }

  // Sample reservations spread across last 4 months
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const samples = [
    { property: "Marina Skyline 2BR", guest: "Ahmed Khalifa", offset: -90, nights: 4, price: 720 },
    { property: "Marina Skyline 2BR", guest: "Sarah Müller", offset: -60, nights: 7, price: 740 },
    { property: "Marina Skyline 2BR", guest: "Liu Wen", offset: -25, nights: 3, price: 760 },
    { property: "Marina Skyline 2BR", guest: "Roberto Conte", offset: 5, nights: 5, price: 780 },
    { property: "Downtown Burj View", guest: "Olivia Watts", offset: -75, nights: 6, price: 950 },
    { property: "Downtown Burj View", guest: "Mohammed Al-Saud", offset: -40, nights: 4, price: 980 },
    { property: "Downtown Burj View", guest: "Helena Petrov", offset: -10, nights: 8, price: 1010 },
    { property: "Downtown Burj View", guest: "James Carter", offset: 12, nights: 3, price: 990 },
    { property: "JBR Beachfront Studio", guest: "Nora Ibrahim", offset: -55, nights: 5, price: 540 },
    { property: "JBR Beachfront Studio", guest: "Tomás Rivera", offset: -20, nights: 10, price: 560 },
    { property: "JBR Beachfront Studio", guest: "Anna Ivanova", offset: 3, nights: 4, price: 580 },
    { property: "JBR Beachfront Studio", guest: "Daniel Owen", offset: 20, nights: 6, price: 590 },
  ];

  for (const s of samples) {
    const checkIn = new Date(today);
    checkIn.setDate(today.getDate() + s.offset);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + s.nights);
    const propertyId = propertyMap[s.property];
    const externalId = `seed-${s.property}-${s.guest.replace(/\s/g, "")}`;
    const cleaning = s.price < 700 ? 150 : 200;
    const total = s.price * s.nights + cleaning;
    const filled = s.offset < 0;
    await prisma.reservation.upsert({
      where: { propertyId_externalId: { propertyId, externalId } },
      update: {
        guestName: s.guest,
        checkIn,
        checkOut,
        nights: s.nights,
        pricePerNight: s.price,
        cleaningFee: cleaning,
        totalPrice: total,
        payout: total - cleaning * 0.1,
        currency: "AED",
        detailsFilled: filled,
      },
      create: {
        propertyId,
        externalId,
        source: "seed",
        guestName: s.guest,
        numGuests: 2,
        checkIn,
        checkOut,
        nights: s.nights,
        pricePerNight: s.price,
        cleaningFee: cleaning,
        totalPrice: total,
        payout: total - cleaning * 0.1,
        currency: "AED",
        detailsFilled: filled,
      },
    });
  }

  console.log(`Seeded admin=${admin.email}, owner=${owner.email}, properties=${Object.keys(propertyMap).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
