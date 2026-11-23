import type {
  ExtensionWebviewNotificationsAdapter,
  ExtensionWebviewSettingsAdapter,
} from "@pstdio/workbench/extensions";
import { getApiClient } from "@/lib/api";
import type { RuntimeCollections } from "@/lib/sync/collections";
import { getExtensionSettingOperations } from "./extension-setting-operations";
import { getCachedDashboardExtensionMetadata } from "./workbench-extension-contributions";

export const createDashboardWebviewSettingsAdapter = (
  runtime: RuntimeCollections,
  props: { projectId?: string; extensionId?: string; extensionInstanceId?: string; installName?: string },
  installedExtensionId: string | undefined,
  assertViewerCurrent: () => void,
): ExtensionWebviewSettingsAdapter | undefined => {
  const { projectId, extensionId, extensionInstanceId: instanceId, installName } = props;
  const target = { projectId, instanceId, installedExtensionId, installName };
  if (!(target.projectId && target.instanceId) && !target.installName) return;
  const settings = getExtensionSettingOperations(runtime);
  const endpoint = settings.transport(target);
  const authority = settings.authority();
  const assertCurrent = () => {
    assertViewerCurrent();
    if (settings.authority() !== authority) throw new Error("This extension setting belongs to a closed account.");
  };
  const write = async (key: string, value: unknown) => {
    assertCurrent();
    const declared = getCachedDashboardExtensionMetadata(projectId, runtime)?.settingsDefinitions?.find(
      (definition) => definition.key === key && definition.extensionId === extensionId,
    );
    const definition = declared ?? (await endpoint.get(key));
    return settings.update(target, definition, value, assertCurrent);
  };
  return {
    async all() {
      assertCurrent();
      const result = await endpoint.all();
      assertCurrent();
      return Object.fromEntries(result.settings.map((record) => [record.key, settings.project(target, record).value]));
    },
    async get(key) {
      assertCurrent();
      const result = await endpoint.get(key);
      assertCurrent();
      return settings.project(target, result).value;
    },
    async set(key, value) {
      const result = await write(key, value);
      return { value: result.setting?.value };
    },
    async delete(key) {
      await write(key, undefined);
    },
  };
};

export const createDashboardWebviewNotificationsAdapter = (input: {
  projectId?: string;
  extensionId: string;
  showNotice: (notice: { type?: "info" | "success" | "warning"; title?: string; description?: string }) => void;
  showError: (notice: { title?: string; description?: string }) => void;
}) => {
  const projectId = input.projectId;
  return {
    show: (notice) => {
      if (notice.type === "error") {
        input.showError({ title: notice.title ?? "Extension action failed", description: notice.message });
        return;
      }
      input.showNotice({ type: notice.type, title: notice.title, description: notice.message });
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
