import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mariadb", "@prisma/adapter-mariadb"],
  turbopack: {
    root: projectRoot,
  },
  // Webpack handles the production build. pptxgenjs ships an ESM build
  // that imports `node:fs` / `node:https` behind a Node-only runtime
  // guard, but webpack still parses those statically and bails when
  // bundling for the browser. Replace them with an empty shim so the
  // client bundle compiles; the Node-only branches are never reached
  // at runtime in the browser anyway.
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:(fs|https)$/,
          path.resolve(projectRoot, "src/lib/empty-node-shim.js"),
        ),
      );
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
