import type { CommandExecuteRequest, UpgradeProjectExtensionResponse } from "@pstdio/sdk/api";
import type { ScopedQuery } from "@pstdio/sdk/extensions";
import { useScopedQuery } from "@pstdio/sdk/extensions/react";
import { addLocalExtensionFolder, type DroppedExtensionFolder } from "./api";
import { getAutomationPreferences } from "./automation-preferences";
import { publishExtensionCommandEvent } from "./extension-webview-broadcast";
import { getProjectExtensionQueries } from "./project-extension-queries";
import { trackExtensionSourceChange, useExtensionMutation } from "./use-extension-mutation";
import { surfaceWebviewCommandOutcome } from "./webview-command-outcome";

const useCatalogQuery = <T>(query: ScopedQuery<T>, active: boolean) => {
  const snapshot = useScopedQuery(query, active);
  return {
    ...snapshot,
    isLoading: active && snapshot.data === undefined && !snapshot.error,
    isSuccess: snapshot.data !== undefined && !snapshot.error,
  };
};
export const useProjectExtensionMetadata = (projectId: string | undefined) =>
  useCatalogQuery(getProjectExtensionQueries(projectId).metadata, Boolean(projectId));
export const useProjectExtensions = (projectId: string | undefined) =>
  useCatalogQuery(getProjectExtensionQueries(projectId).extensions, Boolean(projectId));
export const useExtensionContributions = (projectId: string | undefined, instanceId: string | undefined) =>
  useCatalogQuery(getProjectExtensionQueries(projectId).contributions(instanceId), Boolean(projectId && instanceId));
export const useMarketplaceExtensionContributions = (projectId: string | undefined, installName: string | undefined) =>
  useCatalogQuery(getProjectExtensionQueries(projectId).marketplace(installName), Boolean(projectId && installName));
export const useProjectExtensionSettings = (projectId: string | undefined, instanceId: string | undefined) =>
  useCatalogQuery(getProjectExtensionQueries(projectId).settings(instanceId), Boolean(projectId && instanceId));

export const useInstallMarketplaceExtension = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "install", {
    run: ({ installName, force }: { installName: string; force?: boolean }, { api, projectId }) =>
      api.extensions.install(projectId, { source: { kind: "catalog", name: installName }, force }),
    accept: (result, _value, cache) => cache.storeExtension(result.extension),
  });
export const useAddLocalExtensionFolder = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "add-folder", {
    run: (folder: DroppedExtensionFolder, { api, projectId }) => addLocalExtensionFolder(projectId, folder, api),
    accept: (result, _value, cache) => cache.storeExtension(result.extension),
  });
export const useSetProjectExtensionEnabled = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "enabled", {
    run: ({ instanceId, enabled }: { instanceId: string; enabled: boolean }, { api, projectId }) =>
      api.extensions.setEnabled(projectId, instanceId, enabled),
    accept: (extension, _value, cache) => cache.storeExtension(extension),
  });
export const useSetExtensionAutomationEnabled = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "automation", {
    run: (input: { instanceId: string; automationId: string; enabled: boolean }, target) =>
      getAutomationPreferences(target.owner).update(target.projectId, input, target.assertCurrent),
  });
export const useReloadProjectExtension = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "reload", {
    run: ({ instanceId, title }: { instanceId: string; title: string }, target) =>
      trackExtensionSourceChange(target, { instanceId, title }, () =>
        target.api.extensions.reload(target.projectId, instanceId),
      ),
    accept: (_result, _value, cache) => cache.refresh(),
  });
export const useUpgradeProjectExtension = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "upgrade", {
    run: (
      {
        instanceId,
        schedule,
      }: {
        instanceId: string;
        schedule?: (send: () => Promise<UpgradeProjectExtensionResponse>) => Promise<UpgradeProjectExtensionResponse>;
      },
      { api, projectId, assertCurrent },
    ) => {
      const send = () => {
        assertCurrent();
        return api.extensions.upgradeProject(projectId, instanceId);
      };
      return schedule ? schedule(send) : send();
    },
    accept: (result, _value, cache) => cache.acceptUpgrade(result.extension),
  });
export const useUpdateProjectExtensionSetting = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "setting", {
    run: async (
      { instanceId, key, value }: { instanceId: string; key: string; value: unknown },
      { api, projectId },
    ) => {
      if (value === undefined) return api.extensions.projectSettings.delete(projectId, instanceId, key);
      return api.extensions.projectSettings.set(projectId, instanceId, key, value);
    },
    accept: (_result, variables, cache) => cache.invalidateSettings(variables.instanceId),
  });
export const useUninstallProjectExtension = (projectId: string | undefined) =>
  useExtensionMutation(projectId, "uninstall", {
    run: (input: { instanceId: string; title: string; deleteUserData?: boolean }, target) =>
      trackExtensionSourceChange(
        target,
        { ...input, draft: { instanceId: input.instanceId, deleteUserData: input.deleteUserData === true } },
        () => target.api.extensions.uninstall(target.projectId, input.instanceId, input.deleteUserData),
      ),
    accept: (_result, variables, cache) => cache.removeExtension(variables.instanceId),
  });
export const useExecuteExtensionCommand = (
  projectId: string | undefined,
  showNotice: Parameters<typeof surfaceWebviewCommandOutcome>[1],
) =>
  useExtensionMutation(projectId, "execute", {
    run: (
      {
        commandId,
        body,
        signal,
      }: { commandId: string; body: Omit<CommandExecuteRequest, "projectId">; signal?: AbortSignal },
      { api, projectId },
    ) => api.extensions.execute(commandId, { ...body, projectId }, { signal }),
    accept: (response, _value, _cache, { projectId, owner }) => {
      publishExtensionCommandEvent(response, { projectId }, owner);
      surfaceWebviewCommandOutcome(response, showNotice);
    },
  });
