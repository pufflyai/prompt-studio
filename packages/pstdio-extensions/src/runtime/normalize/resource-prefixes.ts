import { createDiagnostic } from "../diagnostics";
import type { Accumulator } from "./accumulator";

export const validateResourcePrefixes = (runtime: Accumulator) => {
  const owners = new Map<string, (typeof runtime.resourceKinds)[number]>();
  for (const record of runtime.resourceKinds) {
    const prefix = record.contribution.prefix;
    if (prefix === undefined) continue;
    const projectDerived = typeof prefix === "object" && prefix !== null && prefix.$prefix === "project";
    const validLiteral = typeof prefix === "string" && /^[A-Z][A-Z0-9]{0,15}$/.test(prefix) && prefix !== "WS";
    const key = projectDerived ? "$project" : String(prefix);
    const owner = owners.get(key);
    if (!projectDerived && !validLiteral) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_resource_prefix_invalid",
          severity: "error",
          extensionId: record.extensionId,
          sourcePath: record.sourcePath,
          message: `Resource kind "${record.id}" needs an uppercase alphanumeric prefix or projectPrefix(); WS is reserved.`,
        }),
      );
    } else if (owner) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "extension_resource_prefix_duplicate",
          severity: "error",
          extensionId: record.extensionId,
          sourcePath: record.sourcePath,
          message: `Resource kind "${record.id}" cannot claim prefix "${key}"; it is already declared by ${owner.extensionId}/${owner.id}.`,
          metadata: { existingId: owner.id, existingExtensionId: owner.extensionId },
        }),
      );
    } else {
      owners.set(key, record);
    }
  }
};
