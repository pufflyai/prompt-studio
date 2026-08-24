import type { ResourceRef } from "../../../core";

interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resource: ResourceRef | undefined;
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
  const resourceValue = resource
    ? stableValue({ id: resource.id, kind: resource.kind, metadata: resource.metadata, uri: resource.uri })
    : null;
  return `${fileRendererId}:${JSON.stringify(resourceValue)}`;
};

export const isCurrentLoadedFile = (loaded: { loadKey: string } | null, loadKey: string) => loaded?.loadKey === loadKey;
