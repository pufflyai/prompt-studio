import type { ProjectExtensionInstance, WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { type ScopedQueryClient, viewDataEvents } from "@pstdio/sdk/extensions";
import type { QueryClient } from "@tanstack/react-query";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { invalidateWorkspaceProviders, workspaceProvidersQueryKey } from "@/shared/workspaces/workspace-providers";
import { getProjectExtensionQueries } from "./project-extension-queries";
import type { DashboardExtensionMetadata } from "./types";

export const projectExtensionsQueryKey = (projectId: string | undefined, queries?: ScopedQueryClient) =>
  getProjectExtensionQueries(projectId, { queries }).extensions.key;
export const projectExtensionMetadataQueryKey = (projectId: string | undefined, queries?: ScopedQueryClient) =>
  getProjectExtensionQueries(projectId, { queries }).metadata.key;

export const invalidateExtensionQueries = (
  queryClient: QueryClient,
  projectId: string | undefined,
  queries = getDashboardScopedQueries(),
) => {
  queries.invalidate({ type: "changed", id: viewDataEvents.extensionCatalogChanged.id, projectId });
  return invalidateExtensionAuxiliaryQueries(queryClient, projectId);
};
export const invalidateExtensionAuxiliaryQueries = (queryClient: QueryClient, projectId: string | undefined) =>
  Promise.all([
    invalidateWorkspaceProviders(queryClient, projectId),
    queryClient.invalidateQueries({ queryKey: ["agents-info"] }),
    queryClient.invalidateQueries({ queryKey: ["agent-models"] }),
  ]);

const replaceAutomation = (
  current: DashboardExtensionMetadata | undefined,
  automation: WorkbenchExtensionAutomationRecord,
  instanceId: string,
) => {
  if (!current) return current;
  let found = false;
  const automations = (current.automations ?? []).map((entry) => {
    if (entry.id !== automation.id || entry.extensionInstanceId !== instanceId) return entry;
    found = true;
    return automation;
  });
  return { ...current, automations: found ? automations : [...automations, automation] };
};

export const createProjectExtensionCache = (
  queryClient: QueryClient,
  projectId: string | undefined,
  queries = getDashboardScopedQueries(),
  input: { instanceId?: string } = {},
) => {
  const catalog = getProjectExtensionQueries(projectId, { queries });
  const metadataQuery = catalog.metadata;
  const stopMetadata = metadataQuery.subscribe(() => {}, { automatic: false });
  const extensionsQuery = catalog.extensions;
  const stopExtensions = extensionsQuery.subscribe(() => {}, { automatic: false });
  const contribution = input.instanceId ? catalog.contributions(input.instanceId) : undefined;
  const stopContribution = contribution?.subscribe(() => {}, { automatic: false });
  const settings = input.instanceId ? catalog.settings(input.instanceId) : undefined;
  const stopSettings = settings?.subscribe(() => {}, { automatic: false });
  let closed = false;
  const valid = () => !closed && !metadataQuery.isDisposed() && !extensionsQuery.isDisposed();
  const cancelWorkspaceReads = () => queryClient.cancelQueries({ queryKey: workspaceProvidersQueryKey(projectId) });
  const refresh = () => {
    if (valid()) void invalidateExtensionQueries(queryClient, projectId, queries);
  };
  return {
    get active() {
      return valid();
    },
    dispose() {
      if (closed) return;
      closed = true;
      stopMetadata();
      stopExtensions();
      stopContribution?.();
      stopSettings?.();
    },
    refresh,
    invalidateMetadata() {
      if (valid()) metadataQuery.invalidate();
    },
    invalidateSettings(instanceId: string) {
      if (valid()) (instanceId === input.instanceId ? settings : catalog.settings(instanceId))?.invalidate();
    },
    async storeExtension(extension: ProjectExtensionInstance) {
      if (!valid()) return;
      await cancelWorkspaceReads();
      if (!valid()) return;
      extensionsQuery.cancel();
      const current = extensionsQuery.getSnapshot().data;
      if (current)
        extensionsQuery.accept({
          ...current,
          extensions: [...current.extensions.filter((entry) => entry.id !== extension.id), extension],
          marketplace: current.marketplace.map((entry) =>
            entry.installName === extension.installName ? { ...entry, installed: true } : entry,
          ),
        });
      refresh();
    },
    async removeExtension(instanceId: string) {
      if (!valid()) return;
      await cancelWorkspaceReads();
      if (!valid()) return;
      extensionsQuery.cancel();
      const current = extensionsQuery.getSnapshot().data;
      const removed = current?.extensions.find((extension) => extension.id === instanceId);
      if (current && removed) {
        const extensions = current.extensions.filter((extension) => extension.id !== instanceId);
        const stillInstalled = extensions.some((extension) => extension.installName === removed.installName);
        extensionsQuery.accept({
          ...current,
          extensions,
          marketplace: current.marketplace.map((entry) =>
            entry.installName === removed.installName ? { ...entry, installed: stillInstalled } : entry,
          ),
        });
      }
      refresh();
    },
    async storeAutomation(instanceId: string, automation: WorkbenchExtensionAutomationRecord) {
      if (!valid()) return;
      await cancelWorkspaceReads();
      if (!valid()) return;
      const detailQuery = instanceId === input.instanceId ? contribution! : catalog.contributions(instanceId);
      metadataQuery.cancel();
      detailQuery.cancel();
      const current = metadataQuery.getSnapshot().data;
      const contributions = detailQuery.getSnapshot().data;
      // Disabled extensions retain their complete automation inventory in their detail query.
      const complete =
        current && contributions?.automations
          ? {
              ...current,
              automations: [
                ...(current.automations ?? []).filter((entry) => entry.extensionInstanceId !== instanceId),
                ...contributions.automations,
              ],
            }
          : current;
      const metadata = replaceAutomation(complete, automation, instanceId);
      const detail = replaceAutomation(contributions, automation, instanceId);
      if (metadata) metadataQuery.accept(metadata);
      if (detail) detailQuery.accept(detail);
      refresh();
    },
  };
};
