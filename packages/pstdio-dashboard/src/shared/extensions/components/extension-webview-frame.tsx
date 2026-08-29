import { Center, Text } from "@chakra-ui/react";
import { toaster, useThemePreference } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchTerminalController } from "@pstdio/workbench";
import { createTerminalSessionCapability } from "@pstdio/workbench/extensions";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { apiRequest, buildAbsoluteApiUrl } from "@/lib/api";
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
import { type ExtensionCommandEvent, subscribeToExtensionCommandFeed } from "../extension-webview-broadcast";
import { createDashboardExtensionWebviewCapabilities } from "../extension-webview-capabilities";
import { useExecuteExtensionCommand } from "../use-project-extensions";
import { executeWebviewCommand } from "./extension-webview-command";
import { BridgedWebviewSurface, StaticWebviewSurface, type WebviewDescriptor } from "./extension-webview-surfaces";
import { notificationStatusRouteVerb } from "./notification-transition-route";

interface ExtensionWebviewFrameProps {
  extensionId: string;
  extensionInstanceId?: string;
  installName?: string;
  projectId: string | undefined;
  resource?: { id: string; label?: string; metadata?: Record<string, unknown> };
  terminal?: WorkbenchTerminalController;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
  workbench?: WorkbenchCore;
}
const isDarkPreference = (preference: string) => /dark/i.test(preference);

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? "en";

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const { extensionId, extensionInstanceId, installName, projectId, resource, terminal, title, webview, webviewId } =
    props;
  const { themePreference, setThemePreference } = useThemePreference();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [hostEvents] = useState(createHostEventPublisher);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);
  const [locale, setLocale] = useState(currentLocale);

  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);
  useEffect(() => {
    const onLanguageChanged = () => setLocale(currentLocale());
    i18n.on("languageChanged", onLanguageChanged);
    return () => i18n.off("languageChanged", onLanguageChanged);
  }, []);

  if (!webview) return null;

  const colorScheme = isDarkPreference(themePreference) ? "dark" : "light";
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

  const requireProjectId = () => {
    if (!projectId) throw new Error("Notification capabilities require a project.");
    return projectId;
  };

  const notificationPath = (suffix = "") =>
    `/v1/projects/${encodeURIComponent(requireProjectId())}/notifications${suffix}`;

  const extensionNotificationPath = () =>
    `/v1/projects/${encodeURIComponent(requireProjectId())}/extensions/${encodeURIComponent(extensionId)}/notifications`;

  const resolveNotification = async (params: unknown) => {
    const input = params as { id?: string; dedupeKey?: string; status?: "done" | "dismissed" | "expired" };
    const status = input.status ?? "done";

    if (input.dedupeKey) {
      return apiRequest(notificationPath("/resolve-by-dedupe-key"), {
        method: "POST",
        body: { dedupeKey: input.dedupeKey, status },
      });
    }

    if (!input.id) throw new Error("notification.resolve requires id or dedupeKey.");
    if (status === "expired") throw new Error("notification.resolve by id does not support expired.");

    return apiRequest(notificationPath(`/${encodeURIComponent(input.id)}/${notificationStatusRouteVerb(status)}`), {
      method: "POST",
    });
  };

  const baseCapabilities = {
    "commands.execute": async (params: unknown) => {
      const commandInput = params as Parameters<typeof executeWebviewCommand>[0];
      return executeWebviewCommand({
        ...commandInput,
        workbench: props.workbench,
        executeExtensionCommand: (input) =>
          executeCommand.mutateAsync({
            commandId: input.commandId,
            body: {
              metadata: input.metadata,
              params: input.params,
              repo: input.repo,
              resource: input.resource,
              source: "dashboard",
            },
          }),
      });
    },
    "notification.show": (params: unknown) => {
      const notification = params as {
        level: "error" | "info" | "loading" | "success" | "warning";
        message?: string;
        title?: string;
      };
      toaster.create({ type: notification.level, title: notification.title, description: notification.message });
    },
    "notification.action": (params: unknown) =>
      apiRequest(extensionNotificationPath(), {
        method: "POST",
        body: params,
      }),
    "notification.resolve": resolveNotification,
    "notification.dismiss": (params: unknown) => {
      const input = params as { id?: string; dedupeKey?: string };
      return resolveNotification({ ...input, status: "dismissed" });
    },
    "preferences.get": (params: unknown) => {
      const { name } = params as { name: string };
      if (name === "dashboard.themePreference") return themePreference;
      if (name === "dashboard.locale") return locale;
    },
    "preferences.set": (params: unknown) => {
      const { name, value } = params as { name: string; value: string };
      if (name === "dashboard.themePreference") setThemePreference(value);
      if (name === "dashboard.locale") void i18n.changeLanguage(value);
      return { name, value };
    },
    "extension.settings.all": async () => {
      const response = await listSettings();
      return Object.fromEntries(response.settings.map((setting) => [setting.key, setting.value]));
    },
    "extension.settings.get": (params: unknown) => {
      const { key } = params as { key: string };
      return readSettingValue(key);
    },
    "extension.settings.set": (params: unknown) => {
      const { key, value } = params as { key: string; value: unknown };
      return updateSettingValue(key, value);
    },
    "extension.settings.delete": (params: unknown) => {
      const { key } = params as { key: string };
      return deleteSettingValue(key);
    },
    "host.dispatchKeyboardEvent": (params: unknown) => {
      const event = new KeyboardEvent("keydown", {
        ...(params as KeyboardEventInit),
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    },
    ...(terminal ? { "terminal.session": createTerminalSessionCapability({ terminal, hostEvents }) } : {}),
  };
  const capabilities = createDashboardExtensionWebviewCapabilities({
    base: baseCapabilities,
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
      extensionProps={{ projectId, themePreference, locale, lastCommand, resource, translations }}
      theme={colorScheme}
      capabilities={capabilities}
      hostEvents={hostEvents}
    />
  );
};
