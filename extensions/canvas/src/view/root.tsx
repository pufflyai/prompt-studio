import { Box, Flex, Text } from "@chakra-ui/react";
import {
  artifactChanged,
  createWebviewClient,
  type GuestHost,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildMount } from "../build-mount";
import type { CanvasDefinition } from "../canvas-model";
import type { commands } from "../commands";
import { Button } from "../components/themed-primitives";
import { type CanvasRuntime, createCanvasRuntime } from "../controller/runtime";
import { layoutChanged } from "../events";
import { readLayout } from "../layout";
import { createLayoutSession } from "../layout-session";
import { BuildNotice, type BuildStatus } from "./build-notice";
import { CanvasStage } from "./canvas-stage";
import { CanvasThemeContext, CanvasThemeProvider, readCanvasTheme } from "./canvas-theme";
export interface CanvasProps {
  themePreference?: string;
  resource?: ResourceRef;
  pageLocation?: { resource?: ResourceRef };
}
interface RootProps {
  host: GuestHost;
  propsStore: PropsStore<CanvasProps>;
}
interface ConnectedCanvasProps {
  canvas: CanvasDefinition;
  host: GuestHost;
}
// The runtime owns positions and selection; a new build of the same frames only refreshes them.
const ConnectedCanvas = (props: ConnectedCanvasProps) => {
  const { canvas, host } = props;
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  const [error, setError] = useState("");
  const connection = useRef<ReturnType<typeof createLayoutSession> | undefined>(undefined);
  const latest = useRef(canvas);
  latest.current = canvas;
  useEffect(() => {
    const current = latest.current;
    const client = createWebviewClient<typeof commands>(host);
    const session = createLayoutSession({
      read: () => client.commands["layout.read"]({ canvas: current.id }),
      write: (change) => client.commands["layout.update"]({ canvas: current.id, change }),
      apply: (layout) => controller.replace(layout),
      error: setError,
    });
    const controller = createCanvasRuntime(current, readLayout(null, current.items), (change) => {
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
  }, [host]);
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

type CanvasRead = { status: BuildStatus | "ready"; canvas?: CanvasDefinition; message?: string };

const useCanvasBuild = (host: GuestHost, id: string | undefined) => {
  const [read, setRead] = useState<CanvasRead>();
  useEffect(() => {
    const client = createWebviewClient<typeof commands>(host);
    let active = true;
    const refresh = () =>
      void client.commands["canvas.read"]({ canvas: id }).then(
        (next) => active && setRead(next as CanvasRead),
        (error) => active && setRead({ status: "error", message: String(error) }),
      );
    refresh();
    const unsubscribe = client.events.subscribe(artifactChanged(buildMount), refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [host, id]);
  return read;
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
  const read = useCanvasBuild(host, id);
  let body = <BuildNotice status="loading" />;
  if (read?.status === "ready" && read.canvas) {
    // Frames that appear, disappear or change size start a new runtime, which owns their layout.
    const frames = read.canvas.items.map((item) => `${item.id}:${item.width}x${item.height}`).join("\n");
    body = read.canvas.error ? (
      <BuildNotice status="failed" message={read.canvas.error} name={read.canvas.name} />
    ) : (
      <ConnectedCanvas key={`${read.canvas.id}\n${frames}`} canvas={read.canvas} host={host} />
    );
  } else if (read?.status === "ready") body = <BuildNotice status="removed" />;
  else if (read) body = <BuildNotice status={read.status} message={read.message} />;
  return (
    <CanvasThemeContext value={theme}>
      <CanvasThemeProvider>{body}</CanvasThemeProvider>
    </CanvasThemeContext>
  );
};
