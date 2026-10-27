import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { resourceKey } from "./extension-kernel/resource-key";
import type { PageParams } from "./extension-kernel/types/pages";
import type { ResourceRef } from "./extension-kernel/types/resources";

interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resource: ResourceRef | undefined;
  pageParams?: PageParams;
}

export type NativeDocumentTarget = FileRendererLoadKeyInput;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => {
        if (left < right) return -1;
        return left > right ? 1 : 0;
      })
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
};

export const createFileRendererLoadKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resource } = input;
  const resourceValue = resource
    ? stableValue({ id: resource.id, type: resource.type, metadata: resource.metadata })
    : null;
  const key = `${JSON.stringify(resourceKey(resource))}:${fileRendererId}:${JSON.stringify(resourceValue)}`;
  return input.pageParams ? `${key}:${JSON.stringify(stableValue(input.pageParams))}` : key;
};

/** A document address follows the loaded view, never a browser-supplied file path. */
export const createNativeDocumentKey = (input: FileRendererLoadKeyInput) =>
  bytesToHex(sha256(new TextEncoder().encode(createFileRendererLoadKey(input))));
