import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchCommandExecutionContext } from "./command-registry";

type ResourceParamSchema = Record<string, { type: string; resolvedFrom?: "resource"; resourceType?: string }>;
type ResourceParamEntry = ResourceParamSchema[string] & { key: string };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toIdentifierPrefix = (value: string) =>
  value
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase())
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
const metadataString = (metadata: Record<string, unknown> | undefined, key: string) => {
  const value = metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
};
export const resourceContextValue = (
  entry: ResourceParamEntry,
  context: WorkbenchCommandExecutionContext | undefined,
) => {
  const resource = context?.resource;
  if (!resource) return undefined;
  const metadataValue = metadataString(resource.metadata, entry.key);
  if (metadataValue !== undefined) return metadataValue;
  if (entry.key === `${toIdentifierPrefix(resource.type)}Id`) return resource.id ?? resourceKey(resource);
  if (entry.type === "resource" && (!entry.resourceType || entry.resourceType === resource.type)) {
    return {
      type: resource.type,
      id: resource.id ?? resourceKey(resource),
      ...(resource.label ? { label: resource.label } : {}),
      ...(resource.metadata ? { metadata: resource.metadata } : {}),
    };
  }
  return undefined;
};
export const resolveCommandResourceParams = (
  params: ResourceParamSchema | undefined,
  baseArgs?: unknown,
  context?: WorkbenchCommandExecutionContext,
) => {
  const base = isRecord(baseArgs) ? baseArgs : {};
  return Object.fromEntries(
    Object.entries(params ?? {})
      .map(([key, param]) => ({ ...param, key }))
      .filter((entry) => entry.resolvedFrom === "resource")
      .map((entry) => [
        entry.key,
        Object.hasOwn(base, entry.key) ? base[entry.key] : resourceContextValue(entry, context),
      ]),
  );
};
