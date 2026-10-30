import { Box, Flex, Text } from "@chakra-ui/react";
import { createWebviewClient, type GuestHost, type PropsStore, type ResourceRef } from "@pstdio/sdk/extensions";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type CanvasDefinition, canvases, findCanvas } from "../canvases/definitions";
import { CanvasThemeContext, CanvasThemeProvider, readCanvasTheme } from "../catalog/theme";
import type { commands } from "../commands";
import { Button } from "../components/themed-primitives";
import { type CanvasRuntime, createCanvasRuntime } from "../controller/runtime";
import { layoutChanged } from "../events";
import { readLayout } from "../layout";
import { createLayoutSession } from "../layout-session";
import { CanvasStage } from "./canvas-stage";
export interface CanvasProps {
  themePreference?: string;
  resource?: ResourceRef;
  pageLocation?: { resource?: ResourceRef };
}
interface RootProps {
  host: GuestHost;
  propsStore: PropsStore<CanvasProps>;
}
const ConnectedCanvas = (props: { canvas: CanvasDefinition; host: GuestHost }) => {
  const { canvas, host } = props;
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  const [error, setError] = useState("");
  const connection = useRef<ReturnType<typeof createLayoutSession> | undefined>(undefined);
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    const session = createLayoutSession({
      read: () => client.commands["layout.read"]({ canvas: canvas.id }),
      write: (change) => client.commands["layout.update"]({ canvas: canvas.id, change }),
      apply: (layout) => controller.replace(layout),
      error: setError,
    });
    const controller = createCanvasRuntime(canvas, readLayout(null, canvas.items), (change) => {
      void session.save(change);
    });
    connection.current = session;
    setRuntime(controller);
    const unsubscribe = client.events.subscribe(layoutChanged, () => void session.refresh());
    void session.refresh();
    return () => {
      controller.flush();
      session.dispose();
      connection.current = undefined;
      unsubscribe();
    };
  }, [canvas, host]);
  return (
    <Box w="full" h="full" minH="0" minW="0" display="flex" flexDirection="column">
      {error && (
        <Flex gap="sm" align="center" p="sm">
          <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
            {error}
          </Text>
          <Button size="xs" variant="ghost" onClick={() => void connection.current?.retry()}>
            Retry save
          </Button>
        </Flex>
      )}
      <Box flex="1" minH="0" minW="0">
        {runtime ? (
          <CanvasStage canvas={canvas} runtime={runtime} />
        ) : (
          <Text p="sm" textStyle="paragraph/S/regular">
            Loading canvas…
          </Text>
        )}
      </Box>
    </Box>
  );
};
export const CanvasRoot = (props: RootProps) => {
  const { host, propsStore } = props;
  const current = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
  const [theme, setTheme] = useState(() => readCanvasTheme(current.themePreference ?? "pstdio-light"));
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTheme(readCanvasTheme(current.themePreference ?? "pstdio-light")));
    return () => cancelAnimationFrame(frame);
  }, [current.themePreference]);
  const id = current.resource?.id ?? current.pageLocation?.resource?.id;
  const canvas = id
    ? (() => {
        try {
          return findCanvas(id);
        } catch {
          return undefined;
        }
      })()
    : canvases[0];
  if (!canvas)
    return (
      <Text p="md" role="alert">
        This canvas no longer exists.
      </Text>
    );
  return (
    <CanvasThemeContext value={theme}>
      <CanvasThemeProvider>
        <ConnectedCanvas key={canvas.id} canvas={canvas} host={host} />
      </CanvasThemeProvider>
    </CanvasThemeContext>
  );
};
