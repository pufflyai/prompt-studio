import type { Json } from "./json";

// Canonical JSON: sorted object keys, JSON scalar encoding, preserved array order.
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function fingerprint(value: Json) {
  const encoded = canonicalJson(value);
  if (typeof Bun !== "undefined") return new Bun.CryptoHasher("sha256").update(encoded).digest("hex");
  const bytes = new TextEncoder().encode(encoded);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
