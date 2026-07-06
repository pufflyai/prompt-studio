import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import type { LocalizableString } from "@pstdio/sdk/api";
import { toaster, useThemePreference } from "@pstdio/ui";
import { createHostEventPublisher, ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import type { WorkbenchTerminalController } from "pstdio-workbench/core";
import { createTerminalSessionCapability } from "pstdio-workbench/extensions";
import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { apiRequest, buildAbsoluteApiUrl, buildApiUrl } from "@/lib/api";
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
import { useExecuteExtensionCommand } from "../use-project-extensions";
import { notificationStatusRouteVerb } from "./notification-transition-route";

type WebviewDescriptor = {
  entry: { kind: "package-asset"; path: string; baseUrl: string };
  title?: LocalizableString;
  sandbox?: "default" | "strict";
  assetUrl?: string;
  runtimeUrl?: string;
  moduleUrl?: string;
  styles?: string[];
  capabilities?: string[];
};

interface ExtensionWebviewFrameProps {
  extensionId: string;
  extensionInstanceId?: string;
  installName?: string;
  projectId: string | undefined;
  // Resource the webview is bound to (e.g. a ticket). Forwarded to the guest so
  // resource-scoped editors know which resource to load.
  resource?: { id: string; label?: string };
  // Workbench terminal controller; the `terminal.session` capability is only
  // offered when present.
  terminal?: WorkbenchTerminalController;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
}

const isDarkPreference = (preference: string) => /dark/i.test(preference);

// Mirrors the workbench main area background (editor.background). That token lives
// in pstdio-workbench and isn't part of its public API, so we reference the same
// CSS variable directly. A freshly-mounted iframe paints `about:blank` white until
// the guest runtime applies the theme; an opaque cover in this color hides that
// flash and keeps the webview region matching its surroundings.
const webviewSurfaceBackground = "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))";

const resolveStaticWebviewSrc = (webview: WebviewDescriptor) =>
  webview.assetUrl ? buildApiUrl(webview.assetUrl) : new URL(webview.entry.path, webview.entry.baseUrl).toString();

const resolveStaticWebviewSandbox = (webview: WebviewDescriptor) =>
  webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups";

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? "en";

const WebviewLoadError = (props: { detail?: string }) => {
  const { detail } = props;

  return (
    <Center position="absolute" inset="0" px="md" zIndex={1} bg="bg/80">
      <Stack gap="xs" maxW="md" textAlign="center">
        <Text textStyle="paragraph/S/medium" color="fg.error">
          Extension view failed to load.
        </Text>
        {detail ? (
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {detail}
          </Text>
        ) : null}
      </Stack>
    </Center>
  );
};

const StaticWebviewSurface = (props: {
  colorScheme: "dark" | "light";
  sandbox: string;
  src: string;
  title: string;
}) => {
  const { colorScheme, sandbox, src, title } = props;
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <Box position="relative" width="100%" height="100%" minH="0" bg={webviewSurfaceBackground}>
      {state === "loading" ? (
        <Center position="absolute" inset="0" bg={webviewSurfaceBackground} color="fg.muted" zIndex={1}>
          <Spinner size="sm" />
        </Center>
      ) : null}
      {state === "error" ? <WebviewLoadError /> : null}
      <iframe
        title={title}
        allow="fullscreen"
        allowFullScreen
        src={src}
        sandbox={sandbox}
        width="100%"
        height="100%"
        style={{ border: 0, colorScheme }}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </Box>
  );
};

const BridgedWebviewSurface = (props: {
  capabilities: ExtensionFrameProps["capabilities"];
  extensionProps: unknown;
  hostEvents?: ExtensionFrameProps["hostEvents"];
  theme: "dark" | "light";
  view: ExtensionFrameProps["view"];
}) => {
  const { capabilities, extensionProps, hostEvents, theme, view } = props;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <Box
      position="relative"
      width="100%"
      height="100%"
      minH="0"
      bg={webviewSurfaceBackground}
      display="flex"
      flexDirection="column"
    >
      {error ? (
        <WebviewLoadError detail={error} />
      ) : !ready ? (
        <Center position="absolute" inset="0" bg={webviewSurfaceBackground} color="fg.muted" zIndex={1}>
          <Spinner size="sm" />
        </Center>
      ) : null}
      <ExtensionFrame
        view={view}
        props={extensionProps}
        theme={theme}
        capabilities={capabilities}
        hostEvents={hostEvents}
        title={view.label}
        onReady={() => setReady(true)}
        onError={(err) => setError(err.message)}
      />
    </Box>
  );
};

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

  const capabilities = {
    "commands.execute": async (params: unknown) => {
      const { commandId, params: commandParams } = params as { commandId: string; params?: Record<string, unknown> };
      return executeCommand.mutateAsync({
        commandId,
        body: { params: commandParams, source: "dashboard" },
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

  if (!webview.runtimeUrl || !webview.moduleUrl) {
    if (!webview.assetUrl) {
      return (
        <Center px="md" color="fg.muted">
          <Text textStyle="paragraph/S/regular">Extension view is still building...</Text>
        </Center>
      );
    }

    return (
      <StaticWebviewSurface
        key={webviewId}
        colorScheme={colorScheme}
        title={frameTitle}
        src={resolveStaticWebviewSrc(webview)}
        sandbox={resolveStaticWebviewSandbox(webview)}
      />
    );
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
