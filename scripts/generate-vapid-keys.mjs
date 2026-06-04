// One-shot helper: prints a fresh VAPID key pair. Copy the values
// into .env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
//
//   node scripts/generate-vapid-keys.mjs

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log();
console.log("Also set VAPID_SUBJECT=mailto:you@example.com (any contact URL).");
