import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import type { LocalizableString } from "@pstdio/sdk/api";
import { ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useState } from "react";
import { buildApiUrl } from "@/lib/api";

export type WebviewDescriptor = {
  entry: { kind: "package-asset"; path: string; baseUrl: string };
  title?: LocalizableString;
  sandbox?: "default" | "strict";
  assetUrl?: string;
  runtimeUrl?: string;
  moduleUrl?: string;
  styles?: string[];
  capabilities?: string[];
};

const webviewSurfaceBackground = "var(--chakra-colors-vscode-editor-background, var(--chakra-colors-bg))";

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

export const StaticWebviewSurface = (props: {
  colorScheme: "dark" | "light";
  title: string;
  webview: WebviewDescriptor;
}) => {
  const { colorScheme, title, webview } = props;
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const src = webview.assetUrl
    ? buildApiUrl(webview.assetUrl)
    : new URL(webview.entry.path, webview.entry.baseUrl).toString();
  const sandbox = webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups";

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

export const BridgedWebviewSurface = (props: {
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
        onReady={() => {
          setError(null);
          setReady(true);
        }}
        onError={(err) => setError(err.message)}
      />
    </Box>
  );
};
