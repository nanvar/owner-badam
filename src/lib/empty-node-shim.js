// Empty shim used to satisfy webpack when client-bundled code statically
// references `node:fs` / `node:https`. pptxgenjs guards those imports
// behind a Node-only check at runtime, so they're never actually
// invoked in the browser — we just need webpack to resolve them to
// something valid during bundling.
module.exports = {};
