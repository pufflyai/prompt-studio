import { Box, Center, Stack, Text } from "@chakra-ui/react";
import { createWebviewDiagnostics, ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useState } from "react";

type BridgeWebviewFrameProps = Omit<ExtensionFrameProps, "onDiagnostics" | "onError" | "onReady">;

/** A bridged webview that shows one failure message, in theme colors, when it cannot load. */
export const BridgeWebviewFrame = (props: BridgeWebviewFrameProps) => {
  const { view, ...frameProps } = props;
  const [error, setError] = useState<string | null>(null);
  const diagnostics = createWebviewDiagnostics(view);

  return (
    <Box position="relative" width="100%" height="100%" minH="0" display="flex" flexDirection="column">
      {error ? (
        <Center position="absolute" inset="0" px="md" zIndex={1} bg="bg">
          <Stack gap="xs" maxW="md" textAlign="center">
            <Text textStyle="paragraph/S/medium" color="fg.error">
              Extension view failed to load.
            </Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              {error}
            </Text>
          </Stack>
        </Center>
      ) : null}
      <ExtensionFrame
        view={view}
        {...frameProps}
        onReady={() => {
          diagnostics.onReady();
          setError(null);
        }}
        onDiagnostics={diagnostics.onDiagnostics}
        onError={(nextError) => {
          diagnostics.onError(nextError);
          setError(nextError.message);
        }}
      />
    </Box>
  );
};
