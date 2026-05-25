import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster, useThemePreference } from "@pstdio/ui";
import { ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import { buildAbsoluteApiUrl, buildApiUrl } from "@/lib/api";
import { type ExtensionCommandEvent, subscribeToExtensionCommandFeed } from "../extension-webview-broadcast";
import { useExecuteExtensionCommand } from "../hooks/use-project-extensions";

type WebviewDescriptor = {
  entry: { kind: "package-asset"; path: string; baseUrl: string };
  title?: string;
  sandbox?: "default" | "strict";
  assetUrl?: string;
  runtimeUrl?: string;
  moduleUrl?: string;
  styles?: string[];
  capabilities?: string[];
};

interface ExtensionWebviewFrameProps {
  extensionId: string;
  projectId: string | undefined;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
}

interface WebviewLoadErrorProps {
  detail?: string;
}

const WebviewLoadError = (props: WebviewLoadErrorProps) => {
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

const isDarkPreference = (preference: string) => /dark/i.test(preference);

const resolveStaticWebviewSrc = (webview: WebviewDescriptor) =>
  webview.assetUrl ? buildApiUrl(webview.assetUrl) : new URL(webview.entry.path, webview.entry.baseUrl).toString();

const resolveStaticWebviewSandbox = (webview: WebviewDescriptor) =>
  webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups";

const StaticWebviewSurface = (props: { sandbox: string; src: string; title: string }) => {
  const { sandbox, src, title } = props;
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <Box position="relative" width="100%" height="100%" minH="0" bg="bg">
      {state === "loading" ? (
        <Center position="absolute" inset="0" color="fg.muted">
          <Spinner size="sm" />
        </Center>
      ) : null}
      {state === "error" ? <WebviewLoadError /> : null}
      <iframe
        title={title}
        src={src}
        sandbox={sandbox}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </Box>
  );
};

const BridgedWebviewSurface = (props: {
  capabilities: ExtensionFrameProps["capabilities"];
  extensionProps: unknown;
  theme: "dark" | "light";
  view: ExtensionFrameProps["view"];
}) => {
  const { capabilities, extensionProps, theme, view } = props;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  return (
    <Box position="relative" width="100%" height="100%" minH="0" bg="bg" display="flex" flexDirection="column">
      {error ? (
        <WebviewLoadError detail={error} />
      ) : !ready ? (
        <Center position="absolute" inset="0" color="fg.muted" pointerEvents="none" opacity={0.6} zIndex={0}>
          <Spinner size="sm" />
        </Center>
      ) : null}
      <ExtensionFrame
        view={view}
        props={extensionProps}
        theme={theme}
        capabilities={capabilities}
        title={view.label}
        onReady={() => setReady(true)}
        onError={(err) => setError(err.message)}
      />
    </Box>
  );
};

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const { extensionId, projectId, title, webview, webviewId } = props;
  const { themePreference, setThemePreference } = useThemePreference();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);

  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);

  if (!webview) return null;

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
    "preferences.get": (params: unknown) => {
      const { name } = params as { name: string };
      if (name === "dashboard.themePreference") return themePreference;
    },
    "preferences.set": (params: unknown) => {
      const { name, value } = params as { name: string; value: string };
      if (name === "dashboard.themePreference") setThemePreference(value);
      return { name, value };
    },
    "host.dispatchKeyboardEvent": (params: unknown) => {
      const event = new KeyboardEvent("keydown", {
        ...(params as KeyboardEventInit),
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    },
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
        title={webview.title ?? title ?? "Extension view"}
        src={resolveStaticWebviewSrc(webview)}
        sandbox={resolveStaticWebviewSandbox(webview)}
      />
    );
  }

  const view = {
    id: webviewId,
    extensionId,
    label: webview.title ?? title ?? "Extension view",
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
      extensionProps={{ projectId, themePreference, lastCommand }}
      theme={isDarkPreference(themePreference) ? "dark" : "light"}
      capabilities={capabilities}
    />
  );
};
