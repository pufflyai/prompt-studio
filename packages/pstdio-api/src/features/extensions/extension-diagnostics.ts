import type { ExtensionDiagnostic, ExtensionsCheckResponse } from "pstdio-api-contracts";

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const addDiagnostic = (check: ExtensionsCheckResponse, diagnostic: ExtensionDiagnostic) => {
  check.diagnostics.push(diagnostic);
  if (diagnostic.severity === "error") check.errorCount += 1;
  if (diagnostic.severity === "warning") check.warningCount += 1;
};
