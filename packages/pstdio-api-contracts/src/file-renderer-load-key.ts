import { fingerprint } from "pstdio-sync-contracts";
import type { PageParams } from "./extension-kernel/types/pages";
import type { ResourceRef } from "./extension-kernel/types/resources";

interface FileRendererLoadKeyInput {
  fileRendererId: string;
  resource: ResourceRef | undefined;
  pageParams?: PageParams;
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
  const identity =
    resource && JSON.stringify([resource.extensionId ?? "", resource.projectId ?? "", resource.type, resource.id]);
  const resourceValue = resource
    ? stableValue({ id: resource.id, type: resource.type, metadata: resource.metadata })
    : null;
  // Resource removal evicts every renderer variant through this identity prefix.
  const key = `${JSON.stringify(identity)}:${fileRendererId}:${JSON.stringify(resourceValue)}`;
  return input.pageParams ? `${key}:${JSON.stringify(stableValue(input.pageParams))}` : key;
};

export const createFileRendererDocumentKey = (input: FileRendererLoadKeyInput) => {
  const { fileRendererId, resource } = input;
  const identity =
    resource && JSON.stringify([resource.extensionId ?? "", resource.projectId ?? "", resource.type, resource.id]);
  const pageParams =
    input.pageParams &&
    Object.fromEntries(
      Object.entries(input.pageParams).map(([key, value]) => [key, typeof value === "object" ? [...value] : value]),
    );
  return fingerprint([fileRendererId, identity ?? null, resource?.metadata ?? null, pageParams ?? null]);
};
