import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { z } from "zod";

const name = z.string().min(1);
const field = z.string().startsWith("/");
export const nativeDocumentSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("record"), recordId: name, field }),
  z.strictObject({ kind: z.literal("collection"), collection: name, id: name, field }),
  z.strictObject({ kind: z.literal("blob"), id: name, identity: name }),
  z.strictObject({ kind: z.literal("artifact"), mount: name, path: name, identity: name }),
  z.strictObject({ kind: z.literal("workspace"), path: name }),
]);
export type NativeDocumentSource = z.infer<typeof nativeDocumentSourceSchema>;

/** Resolved source identities belong to the extension, independently of its views and labels. */
export const createNativeSourceKey = (identity: string[]) =>
  bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(identity))));
