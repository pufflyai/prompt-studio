import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import { toaster, useThemePreference } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { WebviewCapabilityDiagnostic } from "pstdio-extensions/bridge/contract";
import { ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import { type ExtensionCommandEvent, subscribeToExtensionCommandFeed } from "../extension-webview-broadcast";
import { useExecuteExtensionCommand } from "../hooks/use-project-extensions";
import { createDashboardWebviewHostCapabilities } from "../webview-host-capabilities";

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
  webview?: WebviewDescriptor;
  webviewId: string;
  extensionId: string;
  title?: string;
}

interface WebviewLoadErrorProps {
  detail?: string;
}

const WebviewLoadError = ({ detail }: WebviewLoadErrorProps) => (
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

const isDarkPreference = (preference: string) => /dark/i.test(preference);

const resolveStaticWebviewSrc = (webview: WebviewDescriptor) =>
  webview.assetUrl ? buildApiUrl(webview.assetUrl) : new URL(webview.entry.path, webview.entry.baseUrl).toString();

const resolveStaticWebviewSandbox = (webview: WebviewDescriptor) =>
  webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups";

interface StaticWebviewSurfaceProps {
  title: string;
  src: string;
  sandbox: string;
}

// Owns load/error state for the static-iframe path. The parent passes a `key` derived
// from the view identity so navigating to a different static view remounts and clears
// stale overlay state.
const StaticWebviewSurface = ({ title, src, sandbox }: StaticWebviewSurfaceProps) => {
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

interface BridgedWebviewSurfaceProps {
  view: ExtensionFrameProps["view"];
  extensionProps: unknown;
  theme: "dark" | "light";
  capabilities: ExtensionFrameProps["capabilities"];
}

// Owns ready/error state for the bridged-iframe path. The parent passes a `key` derived
// from the view identity so navigating to a different bridged view remounts and clears
// stale overlay state.
const BridgedWebviewSurface = ({ view, extensionProps, theme, capabilities }: BridgedWebviewSurfaceProps) => {
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
        onDiagnostics={(diagnostics) => setError(describeWebviewDiagnostics(diagnostics))}
      />
    </Box>
  );
};

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const { webview, webviewId, extensionId, title } = props;
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { themePreference, setThemePreference } = useThemePreference();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);

  // Subscribe to host-side extension command executions so we can forward them into the
  // guest's `propsStore`. The bridge's propsUpdate effect picks up changes to the `props`
  // prop on every render, which is exactly what we want.
  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);

  const capabilities = createDashboardWebviewHostCapabilities({
    dispatchKeyboardEvent: dispatchHostKeyboardEvent,
    emitActivity: surfaceActivity,
    executeCommand: ({ commandId, body }) => executeCommand.mutateAsync({ commandId, body }),
    openResource: (input) => openDashboardResource(input, navigate),
    projectId,
    reportDiagnostic: surfaceGuestDiagnostic,
    setThemePreference,
    showNotification: (notification) =>
      toaster.create({
        description: notification.message,
        title: notification.title,
        type: notification.level,
      }),
    themePreference,
  });

  const view =
    webview?.runtimeUrl && webview.moduleUrl
      ? {
          extensionId,
          id: webviewId,
          label: webview.title ?? title ?? "Extension view",
          webview: {
            capabilities: webview.capabilities,
            moduleUrl: buildApiUrl(webview.moduleUrl),
            runtimeUrl: buildApiUrl(webview.runtimeUrl),
            styles: (webview.styles ?? []).map(buildApiUrl),
          },
        }
      : null;

  const extensionProps = { lastCommand, projectId, themePreference };

  if (!webview) return null;

  if (!view && webview.assetUrl) {
    return (
      <StaticWebviewSurface
        key={webviewId}
        title={webview.title ?? title ?? "Extension view"}
        src={resolveStaticWebviewSrc(webview)}
        sandbox={resolveStaticWebviewSandbox(webview)}
      />
    );
  }

  if (!view) {
    return (
      <Center px="md" color="fg.muted">
        <Text textStyle="paragraph/S/regular">Extension view is still building...</Text>
      </Center>
    );
  }

  return (
    <BridgedWebviewSurface
      key={view.id}
      view={view}
      extensionProps={extensionProps}
      theme={isDarkPreference(themePreference) ? "dark" : "light"}
      capabilities={capabilities}
    />
  );
};

const describeWebviewDiagnostics = (diagnostics: WebviewCapabilityDiagnostic[]) =>
  diagnostics.map((diagnostic) => diagnostic.message).join("\n");

const dispatchHostKeyboardEvent = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
  document.dispatchEvent(event);
};

const openDashboardResource = (input: unknown, navigate: ReturnType<typeof useNavigate>) => {
  const record = input as { href?: unknown };
  if (typeof record.href !== "string" || record.href.length === 0) {
    throw new Error("resource.open requires href in dashboard webviews.");
  }
  if (/^https?:\/\//.test(record.href)) {
    window.open(record.href, "_blank", "noopener,noreferrer");
    return;
  }
  navigate({ to: record.href });
};

const surfaceActivity = (item: unknown) => {
  const record = item as { message?: unknown; severity?: unknown; title?: unknown };
  if (typeof record.title !== "string") return;
  toaster.create({
    description: typeof record.message === "string" ? record.message : undefined,
    title: record.title,
    type: record.severity === "error" ? "error" : record.severity === "warning" ? "warning" : "info",
  });
};

const surfaceGuestDiagnostic = (diagnostic: unknown) => {
  const record = diagnostic as { message?: unknown; severity?: unknown; source?: unknown };
  if (typeof record.message !== "string") return;
  toaster.create({
    description: typeof record.source === "string" ? record.source : undefined,
    title: record.message,
    type: record.severity === "error" ? "error" : "warning",
  });
};
