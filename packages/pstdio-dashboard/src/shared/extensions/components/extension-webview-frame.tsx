import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useEffect, useMemo, useState } from "react";
import { useOpenCommandPalette } from "@/features/shortcuts/shortcut-provider";
import { buildApiUrl } from "@/lib/api";
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
      />
    </Box>
  );
};

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const { webview, webviewId, extensionId, title } = props;
  const { projectId } = useParams({ strict: false });
  const { themePreference, setThemePreference } = useThemePreference();
  const openCommandPalette = useOpenCommandPalette();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);

  // Subscribe to host-side extension command executions so we can forward them into the
  // guest's `propsStore`. The bridge's propsUpdate effect picks up changes to the `props`
  // prop on every render, which is exactly what we want.
  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);

  // Capabilities the guest can invoke via host.call(method, params). `commands.execute`
  // routes through the React Query mutation so notices toast and the broadcast feed
  // publishes — host- and guest-fired commands take the same path.
  const capabilities = useMemo(
    () => ({
      "commands.execute": async (params: unknown) => {
        const { commandId, body } = params as { commandId: string; body?: Record<string, unknown> };
        return executeCommand.mutateAsync({
          commandId,
          body: { source: "dashboard", ...(body ?? {}) },
        });
      },
      openCommandPalette: () => {
        openCommandPalette();
      },
      setThemePreference: (params: unknown) => {
        const { themePreference: next } = (params ?? {}) as { themePreference?: string };
        if (typeof next === "string" && next.length > 0) setThemePreference(next);
      },
      // Generic keyboard relay: the bridge runtime forwards any modified keypress here and
      // we re-dispatch a synthetic event on the host's document so existing shortcut
      // listeners (palette, theme toggle, etc.) fire — without the guest knowing what
      // shortcuts the host owns.
      "host.dispatchKeyboardEvent": (params: unknown) => {
        const init = params as KeyboardEventInit;
        const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
        document.dispatchEvent(event);
      },
    }),
    [executeCommand, openCommandPalette, setThemePreference],
  );

  const view = useMemo(() => {
    if (!webview?.runtimeUrl || !webview?.moduleUrl) return null;
    return {
      id: webviewId,
      extensionId,
      label: webview.title ?? title ?? "Extension view",
      webview: {
        moduleUrl: buildApiUrl(webview.moduleUrl),
        styles: (webview.styles ?? []).map(buildApiUrl),
        runtimeUrl: buildApiUrl(webview.runtimeUrl),
      },
    };
  }, [webview?.runtimeUrl, webview?.moduleUrl, webview?.styles, webview?.title, webviewId, extensionId, title]);

  // Memoize the props payload so the bridge's propsUpdate fires only when content
  // actually changes — passing a fresh object literal would push to the guest on every
  // host render, churning the guest's effects.
  const extensionProps = useMemo(
    () => ({ projectId, themePreference, lastCommand }),
    [projectId, themePreference, lastCommand],
  );

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
