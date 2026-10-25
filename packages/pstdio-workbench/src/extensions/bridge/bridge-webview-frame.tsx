import { Box, Center, Stack, Text } from "@chakra-ui/react";
import { resolvePageParams } from "pstdio-api-contracts";
import { createWebviewDiagnostics, ExtensionFrame, type ExtensionFrameProps } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";

type BridgeWebviewFrameProps = Omit<ExtensionFrameProps, "onDiagnostics" | "onError" | "onReady"> & {
  workbench: WorkbenchCore;
};

/** A bridged webview that shows one failure message, in theme colors, when it cannot load. */
export const BridgeWebviewFrame = (props: BridgeWebviewFrameProps) => {
  const { view, workbench, ...frameProps } = props;
  const [pageState, setPageState] = useState(workbench.pages.store.getState);
  useEffect(() => workbench.pages.store.subscribe((state) => setPageState(state)), [workbench]);
  const page = pageState.activePageId ? workbench.pages.getPage(pageState.activePageId) : undefined;
  const pageProps = {
    pageLocation: pageState.location,
    pageParams: resolvePageParams(page?.params, pageState.location?.params),
  };
  const [error, setError] = useState<string | null>(null);
  const diagnostics = createWebviewDiagnostics(view);

  return (
    <Box
      position="relative"
      width={props.sizing === "content-width" ? "max-content" : "full"}
      height={props.sizing === "content-height" ? "auto" : "full"}
      minH="0"
      display="flex"
      flexDirection="column"
    >
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
        props={{ ...frameProps.props, ...pageProps }}
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
