import { Box, Center, Spinner, Stack, Text } from "@chakra-ui/react";
import type { LocalizableString } from "@pstdio/sdk/api";
import { createWebviewDiagnostics, ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useState } from "react";

export type WebviewDescriptor = {
  entry: { kind: "package-asset"; path: string; baseUrl: string };
  title?: LocalizableString;
  runtimeUrl: string;
  moduleUrl: string;
  originLabel: string;
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
  const diagnostics = createWebviewDiagnostics(view);

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
          diagnostics.onReady();
          setError(null);
          setReady(true);
        }}
        onDiagnostics={diagnostics.onDiagnostics}
        onError={(err) => {
          diagnostics.onError(err);
          setError(err.message);
        }}
      />
    </Box>
  );
};
