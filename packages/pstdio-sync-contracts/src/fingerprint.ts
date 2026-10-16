import type { Json, MutationBody } from "./wire";
import { mutationSchema } from "./wire";

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
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sealMutation(body: MutationBody) {
  const parsed = mutationSchema.parse({ ...body, fingerprint: "0".repeat(64) });
  const { fingerprint: _ignored, ...normalized } = parsed;
  return { ...normalized, fingerprint: await fingerprint(normalized) };
}

export async function validateMutation(input: unknown) {
  const mutation = mutationSchema.parse(input);
  const { fingerprint: supplied, ...body } = mutation;
  if ((await fingerprint(body)) !== supplied) throw new Error("Payload fingerprint does not match");
  return mutation;
}
