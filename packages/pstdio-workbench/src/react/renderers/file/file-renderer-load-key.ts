import type { PageParams } from "@pstdio/sdk/extensions";
import { resourceKey } from "@pstdio/sdk/extensions";
import type { ResourceRef } from "../../../core";

interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resource: ResourceRef | undefined;
  pageParams?: PageParams;
  documentKey?: string;
}
const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
};
export const createFileRendererLoadKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resource } = input;
  if (input.documentKey !== undefined) {
    const key = `${JSON.stringify(resourceKey(resource))}:${fileRendererId}:${input.documentKey}`;
    return input.pageParams ? `${key}:${JSON.stringify(stableValue(input.pageParams))}` : key;
  }
  const resourceValue = resource
    ? stableValue({
        id: resource.id,
        type: resource.type,
        metadata: resource.metadata,
      })
    : null;
  const key = `${JSON.stringify(resourceKey(resource))}:${fileRendererId}:${JSON.stringify(resourceValue)}`;
  return input.pageParams ? `${key}:${JSON.stringify(stableValue(input.pageParams))}` : key;
};
export const isCurrentLoadedFile = (
  loaded: {
    loadKey: string;
  } | null,
  loadKey: string,
) => loaded?.loadKey === loadKey;
