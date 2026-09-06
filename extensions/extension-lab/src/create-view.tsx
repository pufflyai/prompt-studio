import "@pstdio/ui/style.css";
import { Box, Text } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost, type PropsStore } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { type ComponentType, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createExampleHost, type ExampleProps, type ExampleViewInput, ViewContext } from "./view-context";

export const viewBackgrounds = {
  sidenav: "var(--chakra-colors-vscode-sideBar-background, var(--chakra-colors-bg-panel))",
  activity: "var(--chakra-colors-vscode-activityBar-background, var(--chakra-colors-bg-muted))",
  panel: "var(--chakra-colors-vscode-panel-background, var(--chakra-colors-bg-panel))",
  status: "var(--chakra-colors-vscode-statusBar-background, var(--chakra-colors-bg-subtle))",
  widget: "var(--chakra-colors-vscode-editorWidget-background, var(--chakra-colors-bg-panel))",
};

interface ExampleStoreConnection {
  connect(
    host: GuestHost,
    props: PropsStore<ExampleProps>,
    onError: (error: unknown) => void,
    onReady?: () => void,
  ): () => void;
}
interface ExampleRootProps {
  Component: ComponentType<{ input: ExampleViewInput }>;
  bridge: GuestHost;
  propsStore: PropsStore<ExampleProps>;
  store?: ExampleStoreConnection;
  background?: string;
}
const ExampleRoot = (props: ExampleRootProps) => {
  const { Component, bridge, propsStore, store, background } = props;
  const [host] = useState(() => createExampleHost(bridge, propsStore));
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(!store);
  const hostProps = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
  useEffect(
    () =>
      store?.connect(
        bridge,
        propsStore,
        (error) => setError(String(error)),
        () => setReady(true),
      ),
    [bridge, propsStore, store],
  );
  const input = { host, resource: hostProps.resource ?? hostProps.pageLocation?.resource };
  return (
    <ViewContext value={input}>
      <Box h="100dvh" w="full" display="flex" flexDirection="column" overflow="hidden" color="fg" bg={background}>
        {error ? (
          <Text role="alert" color="fg.error" p="sm">
            {error}
          </Text>
        ) : null}
        <Box flex="1" minH="0" minW="0">
          {ready ? <Component input={input} /> : null}
        </Box>
      </Box>
    </ViewContext>
  );
};
export const createExampleView = (
  Component: ExampleRootProps["Component"],
  store?: ExampleStoreConnection,
  background?: string,
) =>
  defineExtensionView<ExampleProps>({
    render({ mount, host, propsStore }) {
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <ExampleRoot
            Component={Component}
            bridge={host}
            propsStore={propsStore}
            store={store}
            background={background}
          />
        </ChakraProvider>,
      );
      return () => root.unmount();
    },
  });
