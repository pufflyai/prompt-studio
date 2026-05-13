import {
  type ContributionMetadata,
  type ContributionSource,
  normalizeContributionMetadata,
  type RegisteredContributionMetadata,
} from "../contributions/metadata";
import { createDisposable } from "../disposable";
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

export interface DiagnosticSourceContribution {
  source: string;
  title: string;
  icon?: string;
}

export type RegisteredDiagnosticSource = DiagnosticSourceContribution &
  Omit<RegisteredContributionMetadata, "source"> & { contributionSource: ContributionSource };

export type RegisteredShellDiagnostic = ShellDiagnostic &
  Omit<RegisteredContributionMetadata, "source"> & { contributionSource: ContributionSource };

interface DiagnosticListFilter {
  severity?: ShellDiagnostic["severity"];
  resourceUri?: string;
  source?: string;
}

export const createDiagnosticRegistry = () => {
  const sources = new Map<string, RegisteredDiagnosticSource>();
  const diagnostics = new Map<string, RegisteredShellDiagnostic>();

  return {
    registerSource(source: DiagnosticSourceContribution, metadata?: ContributionMetadata) {
      if (sources.has(source.source)) throw new Error(`Diagnostic source already registered: ${source.source}`);

      const contribution = normalizeContributionMetadata(metadata);
      const record = {
        ...source,
        contributionSource: contribution.source,
        ownerId: contribution.ownerId,
        priority: contribution.priority,
      };

      sources.set(source.source, record);

      return createDisposable(() => {
        if (sources.get(source.source) === record) sources.delete(source.source);
      });
    },

    getSource(source: string) {
      return sources.get(source);
    },

    listSources() {
      return [...sources.values()];
    },

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
