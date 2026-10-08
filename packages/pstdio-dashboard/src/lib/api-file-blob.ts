const previewTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/x-icon",
  "text/plain",
]);

// A blob document inherits the dashboard origin. Keep uploaded scripts and active documents
// as downloads so opening a file cannot read the browser session or call the API as its owner.
export const safeApiFileBlob = (blob: Blob) =>
  previewTypes.has(blob.type.split(";", 1)[0] ?? "") ? blob : new Blob([blob], { type: "application/octet-stream" });
