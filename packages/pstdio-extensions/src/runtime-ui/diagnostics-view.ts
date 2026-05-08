import type { ExtensionDiagnostic, ExtensionDiagnosticSeverity } from "../types/runtime";

const SEVERITY_RANK: Record<ExtensionDiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export type GroupedDiagnostics = {
  severity: ExtensionDiagnosticSeverity;
  diagnostics: ExtensionDiagnostic[];
};

/** Sort diagnostics most-severe-first then by extension/source. Browser-safe. */
export const sortDiagnostics = (diagnostics: ExtensionDiagnostic[]) =>
  [...diagnostics].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const aKey = `${a.extensionId ?? ""}|${a.sourcePath ?? ""}|${a.code}`;
    const bKey = `${b.extensionId ?? ""}|${b.sourcePath ?? ""}|${b.code}`;
    return aKey.localeCompare(bKey);
  });

export const groupDiagnosticsBySeverity = (diagnostics: ExtensionDiagnostic[]): GroupedDiagnostics[] => {
  const buckets = new Map<ExtensionDiagnosticSeverity, ExtensionDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const bucket = buckets.get(diagnostic.severity) ?? [];
    bucket.push(diagnostic);
    buckets.set(diagnostic.severity, bucket);
  }

  return Array.from(buckets.entries())
    .map(([severity, items]) => ({ severity, diagnostics: items }))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
};
