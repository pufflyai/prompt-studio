import { Center, Text } from "@chakra-ui/react";
import type { ResourceRef, WebviewCommandsStreamParams } from "@pstdio/sdk/extensions";
import { getThemePreferenceMode, toaster, useThemePreference } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelInstance, WorkbenchTerminalController } from "@pstdio/workbench";
import { createTerminalSessionCapability, createWorkbenchWebviewHostCapabilities } from "@pstdio/workbench/extensions";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-webview-path";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { buildAbsoluteApiUrl, getApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { getExtensionTranslationContext, resolveLocalizableString } from "@/shared/extensions/extension-localization";
import {
  deleteGlobalExtensionSetting,
  deleteProjectExtensionSetting,
  getGlobalExtensionSetting,
  getProjectExtensionSetting,
  listGlobalExtensionSettings,
  listProjectExtensionSettings,
  updateGlobalExtensionSetting,
  updateProjectExtensionSetting,
} from "../api";
import { createCommandStreamCapability, withFrameSignal } from "../command-stream-capability";
import {
  type ExtensionCommandEvent,
  publishExtensionCommandEvent,
  subscribeToExtensionCommandFeed,
} from "../extension-webview-broadcast";
import { createDashboardExtensionWebviewCapabilities } from "../extension-webview-capabilities";
import { subscribeWebviewExtensionEvents } from "../extension-webview-events";
import { openExtensionViews } from "../open-extension-views";
import { usePausedExtensions } from "../paused-extensions";
import { useExecuteExtensionCommand, useProjectExtensions } from "../use-project-extensions";
import { useWebviewPageProps } from "../use-webview-page-props";
import { createDashboardOwnedPreferences } from "../webview-owned-preferences";
import { executeWebviewCommand, webviewCommandSlot } from "./extension-webview-command";
import { BridgedWebviewSurface, StaticWebviewSurface, type WebviewDescriptor } from "./extension-webview-surfaces";
import { PausedExtensionView } from "./paused-extension-view";

interface ExtensionWebviewFrameProps {
  extensionId: string;
  extensionInstanceId?: string;
  installName?: string;
  projectId: string | undefined;
  resource?: ResourceRef;
  placement?: WorkbenchPanelInstance;
  terminal?: WorkbenchTerminalController;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
  slotKind?: "panel" | "settings";
  workbench?: WorkbenchCore;
}

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? "en";
const requireProject = (projectId: string | undefined) => {
  if (!projectId) throw new Error("Notification capabilities require a project.");
  return projectId;
};

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const owner = getRuntimeCollections();
  const { extensionId, extensionInstanceId, installName, projectId, resource, terminal, title, webview, webviewId } =
    props;
  const { themePreference, themePreferences } = useThemePreference();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [hostEvents] = useState(createHostEventPublisher);
  const [streamCommand] = useState(() => createCommandStreamCapability(hostEvents));
  const { pageLocation, pageParams } = useWebviewPageProps(props.workbench);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);
  const [locale, setLocale] = useState(currentLocale);
  const paused = usePausedExtensions();
  const projectExtensions = useProjectExtensions(projectId);
  const installedExtensionId = webview?.runtimeUrl
    ? parseExtensionWebviewPath(webview.runtimeUrl)?.scope.installedExtensionId
    : undefined;
  const isPaused = installedExtensionId ? paused.has(installedExtensionId) : false;
  const loads = Boolean(webview?.runtimeUrl && webview.moduleUrl);
  // The performance popover lists every extension with a loaded view.
  useEffect(() => {
    if (!installedExtensionId || isPaused || !loads) return;
    return openExtensionViews.open(installedExtensionId, webviewId);
  }, [installedExtensionId, webviewId, isPaused, loads]);

  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);
  useEffect(() => subscribeWebviewExtensionEvents(hostEvents, projectId), [hostEvents, projectId]);
  useEffect(() => {
    const onLanguageChanged = () => setLocale(currentLocale());
    i18n.on("languageChanged", onLanguageChanged);
    return () => i18n.off("languageChanged", onLanguageChanged);
  }, []);

  if (!webview) return null;

  const colorScheme = getThemePreferenceMode(themePreference, themePreferences);
  const frameTitle = webview.title ? resolveLocalizableString(webview.title, extensionId) : (title ?? "Extension view");
  const translations = getExtensionTranslationContext(extensionId, locale);

  const listSettings = async () => {
    if (projectId && extensionInstanceId) return listProjectExtensionSettings(projectId, extensionInstanceId);
    if (installName) return listGlobalExtensionSettings(installName);
    return { settings: [] };
  };

  const readSettingValue = async (key: string) => {
    if (projectId && extensionInstanceId)
      return (await getProjectExtensionSetting(projectId, extensionInstanceId, key)).value;
    if (installName) return (await getGlobalExtensionSetting(installName, key)).value;
    throw new Error("Extension settings are unavailable without an extension owner.");
  };

  const updateSettingValue = async (key: string, value: unknown) => {
    if (projectId && extensionInstanceId)
      return updateProjectExtensionSetting(projectId, extensionInstanceId, key, value);
    if (installName) return updateGlobalExtensionSetting(installName, key, value);
    throw new Error("Extension settings are unavailable without an extension owner.");
  };

  const deleteSettingValue = async (key: string) => {
    if (projectId && extensionInstanceId) return deleteProjectExtensionSetting(projectId, extensionInstanceId, key);
    if (installName) return deleteGlobalExtensionSetting(installName, key);
    throw new Error("Extension settings are unavailable without an extension owner.");
  };

  const requireProjectId = () => requireProject(projectId);

  const resolveNotification = async (params: unknown) => {
    const input = params as { id?: string; dedupeKey?: string; status?: "done" | "dismissed" | "expired" };
    const status = input.status ?? "done";

    if (input.dedupeKey) {
      return getApiClient().notifications.resolveByDedupeKey(requireProjectId(), {
        dedupeKey: input.dedupeKey,
        status,
      });
    }

    if (!input.id) throw new Error("notification.resolve requires id or dedupeKey.");
    if (status === "expired") throw new Error("notification.resolve by id does not support expired.");

    return status === "dismissed"
      ? getApiClient().notifications.dismiss(requireProjectId(), input.id)
      : getApiClient().notifications.markDone(requireProjectId(), input.id);
  };

  const baseCapabilities = {
    ...(props.workbench
      ? createWorkbenchWebviewHostCapabilities({
          workbench: props.workbench,
          placement: props.placement,
          hostEvents,
          extensionId,
          ownedPreferences: createDashboardOwnedPreferences({
            projectId,
            instanceId: extensionInstanceId,
            installName,
          }),
        })
      : {}),
    "commands.stream": (params: unknown) =>
      streamCommand(params as WebviewCommandsStreamParams, {
        projectId: requireProjectId(),
        stream: (...args) => getApiClient().extensions.stream(...args),
        publish: (response) => publishExtensionCommandEvent(response, { projectId }, owner),
      }),
    "commands.execute": async (params: unknown) => {
      const commandInput = params as Parameters<typeof executeWebviewCommand>[0];
      return withFrameSignal(hostEvents, (signal) =>
        executeWebviewCommand({
          ...commandInput,
          resource: commandInput.resource ?? resource ?? props.placement?.resource,
          slot: webviewCommandSlot({ projectId, webviewId, slotKind: props.slotKind }),
          workbench: props.workbench,
          projectId,
          executeExtensionCommand: (input) =>
            executeCommand.mutateAsync({
              signal,
              commandId: input.commandId,
              body: {
                metadata: input.metadata,
                params: input.params,
                workspaceId: input.workspaceId,
                resource: input.resource,
                slot: input.slot,
                source: "dashboard",
              },
            }),
        }),
      );
    },
    "notification.show": (params: unknown) => {
      const notification = params as {
        level: "error" | "info" | "success" | "warning";
        message?: string;
        title?: string;
      };
      toaster.create({ type: notification.level, title: notification.title, description: notification.message });
    },
    "notification.action": (params: unknown) =>
      getApiClient().extensions.createNotification(
        requireProjectId(),
        extensionId,
        params as import("@pstdio/sdk/extensions").WebviewNotificationActionParams,
      ),
    "notification.resolve": resolveNotification,
    "notification.dismiss": (params: unknown) => {
      const input = params as { id?: string; dedupeKey?: string };
      return resolveNotification({ ...input, status: "dismissed" });
    },
    "extension.settings.all": async () => {
      const response = await listSettings();
      return Object.fromEntries(response.settings.map((setting) => [setting.key, setting.value]));
    },
    "extension.settings.get": (params: unknown) => {
      const { key } = params as { key: string };
      return readSettingValue(key);
    },
    "extension.settings.set": async (params: unknown) => {
      const { key, value } = params as { key: string; value: unknown };
      await updateSettingValue(key, value);
    },
    "extension.settings.delete": async (params: unknown) => {
      const { key } = params as { key: string };
      await deleteSettingValue(key);
    },
    ...(terminal ? { "terminal.session": createTerminalSessionCapability({ terminal, hostEvents }) } : {}),
  };
  const capabilities = createDashboardExtensionWebviewCapabilities({
    base: baseCapabilities,
    extensionId,
    extensionInstanceId,
    projectId,
    webviewId,
    workbench: props.workbench,
  });

  if (!webview.runtimeUrl || !webview.moduleUrl) {
    if (!webview.assetUrl) {
      return (
        <Center px="md" color="fg.muted">
          <Text textStyle="paragraph/S/regular">Extension view is still building...</Text>
        </Center>
      );
    }

    return <StaticWebviewSurface key={webviewId} colorScheme={colorScheme} title={frameTitle} webview={webview} />;
  }

  // A paused extension's frames unmount, so Chromium ends its renderer process.
  if (installedExtensionId && isPaused) {
    const extensionName =
      projectExtensions.data?.extensions.find((extension) => extension.installedExtensionId === installedExtensionId)
        ?.displayName ?? frameTitle;
    return <PausedExtensionView installedExtensionId={installedExtensionId} name={extensionName} />;
  }

  const view = {
    id: webviewId,
    extensionId,
    label: frameTitle,
    webview: {
      moduleUrl: buildAbsoluteApiUrl(webview.moduleUrl),
      capabilities: webview.capabilities,
      styles: (webview.styles ?? []).map((styleUrl) => buildAbsoluteApiUrl(styleUrl)),
      runtimeUrl: buildAbsoluteApiUrl(webview.runtimeUrl),
    },
  };

  return (
    <BridgedWebviewSurface
      key={view.id}
      view={view}
      extensionProps={{
        projectId,
        themePreference,
        locale,
        lastCommand,
        resource,
        pageLocation,
        pageParams,
        translations,
      }}
      theme={colorScheme}
      capabilities={capabilities}
      hostEvents={hostEvents}
    />
  );
};
