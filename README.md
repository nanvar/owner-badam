# Badam Owners

Property management & owner reporting portal for **Badam Holiday Homes** — Dubai short-term rentals.

Mobile-first web app with two roles:

- **Admin** — manages properties (with Airbnb iCal links), owners, reservations, runs sync, edits per-reservation pricing, manages app branding/contact via Settings.
- **Owner** — sees their own dashboard (KPIs, charts, upcoming check-ins), apartments, calendar (FullCalendar), and reports (PDF + Excel export with branded header & contact footer).

## Tech stack

- **Next.js 16** (App Router, Turbopack) + React 19, TypeScript
- **Tailwind CSS v4**
- **Prisma 7** + **PostgreSQL** (with `@prisma/adapter-pg`)
- **jose** (JWT cookie sessions)
- **next-intl** (English / Russian)
- **FullCalendar** (calendar view)
- **Recharts** (charts)
- **node-ical** (Airbnb iCal sync)
- **xlsx**, **jspdf** + **jspdf-autotable** (export)

## Local setup

Requires Node.js ≥ 20.9 (project pinned to `22.12.0` via `.nvmrc`).

```bash
nvm use
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

| Role  | Email             | Password   |
| ----- | ----------------- | ---------- |
| Admin | `admin@demo.com`  | `demo1234` |
| Owner | `owner@demo.com`  | `demo1234` |

## Environment variables

| Name           | Description                                              |
| -------------- | -------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                             |
| `AUTH_SECRET`  | 32+ char secret for signing session JWTs (`openssl rand -base64 32`) |

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # production build
npm run start        # run production build
npm run db:migrate   # apply Prisma migrations
npm run db:reset     # drop & recreate DB (dev only)
npm run db:generate  # regenerate Prisma client
npm run db:seed      # seed admin/owner accounts + sample data + Badam settings
```

## Production / Vercel

1. Provision a PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.).
2. Set `DATABASE_URL` and `AUTH_SECRET` in the Vercel project's environment variables.
3. Push to the linked Git repository — Vercel runs `npm run build` automatically.
4. Run migrations on first deploy (Vercel auto-runs `prisma migrate deploy` if listed in the build command, or run manually):
   ```bash
   npx prisma migrate deploy
   ```
5. Optionally seed Badam defaults via:
   ```bash
   npm run db:seed
   ```
   Then sign in as admin and tweak everything from **Admin → Settings**.

## Branding via Settings

Brand name, logo URL, contact info (email, phone, WhatsApp), website, social media links, booking URL, owner-portal URL, currency, timezone, etc. are all editable from the **Admin → Settings** page (no code redeploy needed).

The brand cascades into:

- App header (logo + name)
- Login page (logo, tagline, contact links)
- Browser metadata (title, favicon)
- PDF exports (branded gradient header + contact footer)
- Excel exports (summary sheet header + contact rows)

---

© Badam Holiday Homes — Dubai
