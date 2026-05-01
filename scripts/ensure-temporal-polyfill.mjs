#!/usr/bin/env node
/**
 * `node-ical` does a hardcoded `require('temporal-polyfill')` inside its
 * source, but its package.json declares the dep under an alias:
 *   "@js-temporal/polyfill": "npm:temporal-polyfill@^0.3.0"
 *
 * On some npm installs (notably Hostinger's deploy), npm dedupes the direct
 * `temporal-polyfill` dependency we list in package.json with the alias and
 * only materializes one of them — `node_modules/@js-temporal/polyfill/` —
 * leaving `node_modules/temporal-polyfill/` missing. node-ical then crashes
 * at runtime with:
 *   "Cannot find module '.../node_modules/temporal-polyfill/index.js'"
 *
 * This script runs in `postinstall` and, if the direct directory is missing,
 * creates a symlink (or copies the contents on Windows) so the require
 * resolves cleanly. Idempotent — does nothing when both already exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const target = path.join(projectRoot, "node_modules", "temporal-polyfill");
const alias = path.join(
  projectRoot,
  "node_modules",
  "@js-temporal",
  "polyfill",
);

if (fs.existsSync(target)) {
  // Either real install or a previously-created symlink — nothing to do.
  process.exit(0);
}

if (!fs.existsSync(alias)) {
  // The alias isn't there either. Probably a fresh install hasn't finished
  // or the package isn't in deps. Don't fail the postinstall — a real npm
  // install error will surface elsewhere.
  console.log(
    "[ensure-temporal-polyfill] no @js-temporal/polyfill found, skipping.",
  );
  process.exit(0);
}

try {
  fs.symlinkSync(alias, target, "dir");
  console.log(
    "[ensure-temporal-polyfill] linked node_modules/temporal-polyfill → @js-temporal/polyfill",
  );
} catch (e) {
  // Fallback for filesystems that disallow symlinks (some shared hosts).
  console.log(
    "[ensure-temporal-polyfill] symlink failed (%s); copying instead.",
    e.message,
  );
  fs.cpSync(alias, target, { recursive: true });
  console.log(
    "[ensure-temporal-polyfill] copied @js-temporal/polyfill → node_modules/temporal-polyfill",
  );
}
