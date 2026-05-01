import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "node-ical",
    "mariadb",
    "@prisma/adapter-mariadb",
  ],
  turbopack: {
    root: projectRoot,
  },
};

export default withNextIntl(nextConfig);
