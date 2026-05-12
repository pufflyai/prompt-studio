import {
  type ContributionMetadata,
  type ContributionSource,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";

export interface DiagnosticAction {
  commandId: string;
  title: string;
  args?: unknown;
}

export interface ShellDiagnostic {
  id: string;
  source: string;
  severity: "error" | "warning" | "info";
  message: string;
  resource?: ResourceRef;
  code?: string;
  actions?: DiagnosticAction[];
  metadata?: Record<string, unknown>;
}

export type RegisteredShellDiagnostic = ShellDiagnostic &
  Omit<RegisteredContributionMetadata, "source"> & { contributionSource: ContributionSource };

interface DiagnosticListFilter {
  severity?: ShellDiagnostic["severity"];
  resourceUri?: string;
  source?: string;
}

export const createDiagnosticRegistry = () => {
  const diagnostics = new Map<string, RegisteredShellDiagnostic>();

  return {
    report(diagnostic: ShellDiagnostic, metadata?: ContributionMetadata) {
      const contribution = normalizeContributionMetadata(metadata);
      const record = {
        ...diagnostic,
        contributionSource: contribution.source,
        ownerId: contribution.ownerId,
        priority: contribution.priority,
      };

      diagnostics.set(diagnostic.id, record);
      return record;
    },

    clear(id: string) {
      diagnostics.delete(id);
    },

    listDiagnostics(filter: DiagnosticListFilter = {}) {
      return [...diagnostics.values()]
        .filter((diagnostic) => !filter.severity || diagnostic.severity === filter.severity)
        .filter((diagnostic) => !filter.resourceUri || diagnostic.resource?.uri === filter.resourceUri)
        .filter((diagnostic) => !filter.source || diagnostic.source === filter.source);
    },
  };
};

export type DiagnosticRegistry = ReturnType<typeof createDiagnosticRegistry>;
