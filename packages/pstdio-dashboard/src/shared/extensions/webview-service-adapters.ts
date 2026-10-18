import { toaster } from "@pstdio/ui";
import type {
  ExtensionWebviewNotificationsAdapter,
  ExtensionWebviewSettingsAdapter,
} from "@pstdio/workbench/extensions";
import { getApiClient } from "@/lib/api";
import {
  deleteGlobalExtensionSetting,
  deleteProjectExtensionSetting,
  getGlobalExtensionSetting,
  getProjectExtensionSetting,
  listGlobalExtensionSettings,
  listProjectExtensionSettings,
  updateGlobalExtensionSetting,
  updateProjectExtensionSetting,
} from "./api";

interface SettingsOwner {
  projectId?: string;
  extensionInstanceId?: string;
  installName?: string;
}

export const createDashboardWebviewSettingsAdapter = (owner: SettingsOwner) => {
  const { projectId, extensionInstanceId, installName } = owner;
  if (projectId && extensionInstanceId)
    return {
      all: async () =>
        Object.fromEntries(
          (await listProjectExtensionSettings(projectId, extensionInstanceId)).settings.map((setting) => [
            setting.key,
            setting.value,
          ]),
        ),
      get: async (key) => (await getProjectExtensionSetting(projectId, extensionInstanceId, key)).value,
      set: async (key, value) => ({
        value: (await updateProjectExtensionSetting(projectId, extensionInstanceId, key, value)).value,
      }),
      delete: async (key) => {
        await deleteProjectExtensionSetting(projectId, extensionInstanceId, key);
      },
    } satisfies ExtensionWebviewSettingsAdapter;
  if (installName)
    return {
      all: async () =>
        Object.fromEntries(
          (await listGlobalExtensionSettings(installName)).settings.map((setting) => [setting.key, setting.value]),
        ),
      get: async (key) => (await getGlobalExtensionSetting(installName, key)).value,
      set: async (key, value) => ({ value: (await updateGlobalExtensionSetting(installName, key, value)).value }),
      delete: async (key) => {
        await deleteGlobalExtensionSetting(installName, key);
      },
    } satisfies ExtensionWebviewSettingsAdapter;
  return undefined;
};

export const createDashboardWebviewNotificationsAdapter = (input: { projectId?: string; extensionId: string }) => {
  const projectId = input.projectId;
  return {
    show: (notice) => {
      toaster.create({ type: notice.type, title: notice.title, description: notice.message });
    },
    ...(projectId
      ? ({
          create: (notice) => getApiClient().extensions.createNotification(projectId, input.extensionId, notice),
          resolve: async (request) => {
            const status = request.status ?? "done";
            if (request.dedupeKey !== undefined)
              return getApiClient().notifications.resolveByDedupeKey(projectId, {
                dedupeKey: request.dedupeKey,
                status,
              });
            if (!request.id) throw new Error("notification.resolve requires id or dedupeKey.");
            if (status === "expired") throw new Error("notification.resolve by id does not support expired.");
            return status === "dismissed"
              ? getApiClient().notifications.dismiss(projectId, request.id)
              : getApiClient().notifications.markDone(projectId, request.id);
          },
        } satisfies ExtensionWebviewNotificationsAdapter)
      : {}),
  } satisfies ExtensionWebviewNotificationsAdapter;
};
