import { Box, Flex, Text } from "@chakra-ui/react";
import {
  artifactChanged,
  createWebviewClient,
  type GuestHost,
  type PageLocation,
  type PropsStore,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { buildMount } from "../build-mount";
import type { CanvasDefinition } from "../canvas-model";
import type { commands } from "../commands";
import { Button } from "../components/themed-primitives";
import { type CanvasRuntime, createCanvasRuntime } from "../controller/runtime";
import { layoutChanged } from "../events";
import { FrameHostContext } from "../frames/frame-loader";
import { readLayout } from "../layout";
import { createLayoutSession } from "../layout-session";
import { canvasPage, canvasTarget, homePage } from "../navigation";
import { BuildNotice, type BuildStatus } from "./build-notice";
import { CanvasStage } from "./canvas-stage";
import { CanvasThemeContext, CanvasThemeProvider, readCanvasTheme } from "./canvas-theme";
export interface CanvasProps {
  themePreference?: string;
  resource?: ResourceRef;
  pageLocation?: PageLocation;
}
interface RootProps {
  host: GuestHost;
  propsStore: PropsStore<CanvasProps>;
}
interface ConnectedCanvasProps {
  visible: boolean;
  canvas: CanvasDefinition;
  host: GuestHost;
}
// The runtime owns positions and selection; a new build of the same frames only refreshes them.
const ConnectedCanvas = (props: ConnectedCanvasProps) => {
  const { canvas, host, visible } = props;
  const [runtime, setRuntime] = useState<CanvasRuntime>();
  useLayoutEffect(() => {
    runtime?.startup.setPaused(!visible);
    if (!visible) runtime?.flush();
  }, [runtime, visible]);
  const [error, setError] = useState("");
  const connection = useRef<ReturnType<typeof createLayoutSession> | undefined>(undefined);
  const latest = useRef(canvas);
  useEffect(() => {
    latest.current = canvas;
  });
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
          <FrameHostContext.Provider value={host}>
            <CanvasStage canvas={canvas} runtime={runtime} visible={visible} />
          </FrameHostContext.Provider>
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

const useCanvasBuild = (host: GuestHost, id: string | undefined, visible: boolean) => {
  const [read, setRead] = useState<CanvasRead>();
  useEffect(() => {
    // A retained frame keeps its draft, but its calling viewer cannot read after navigation away.
    // Refresh on return and fence any result that was still pending when the view became hidden.
    if (!visible) return;
    const client = createWebviewClient<typeof commands>(host);
    let latest = 0;
    const refresh = () => {
      const request = ++latest;
      void client.commands["canvas.read"]({ canvas: id })
        .then((next) => {
          if (request === latest) setRead(next as CanvasRead);
        })
        .catch((error) => {
          if (request === latest) setRead({ status: "error", message: String(error) });
        });
    };
    refresh();
    const unsubscribe = client.events.subscribe(artifactChanged(buildMount), refresh);
    return () => {
      latest++;
      unsubscribe();
    };
  }, [host, id, visible]);
  return read;
};

interface CanvasPaneProps {
  host: GuestHost;
  id?: string;
  visible: boolean;
  selected: boolean;
}

const CanvasPane = ({ host, id, visible, selected }: CanvasPaneProps) => {
  const read = useCanvasBuild(host, id, visible);
  const canvas = read?.canvas;
  const fallback = canvas && canvas.id !== id ? canvas : undefined;
  const [navigationError, setNavigationError] = useState("");
  useEffect(() => {
    if (!visible || !selected || !fallback) return;
    let active = true;
    const client = createWebviewClient<typeof commands>(host);
    setNavigationError("");
    void client.navigation.open(canvasTarget(fallback.id, fallback.name)).catch((error) => {
      if (active) setNavigationError(String(error));
    });
    return () => {
      active = false;
    };
  }, [fallback, host, selected, visible]);
  if (fallback && navigationError) return <BuildNotice status="error" message={navigationError} />;
  if (fallback) return <BuildNotice status={selected ? "loading" : "removed"} />;
  if (!read) return <BuildNotice status="loading" />;
  if (read.status !== "ready") return <BuildNotice status={read.status} message={read.message} />;
  if (!canvas) return <BuildNotice status="removed" />;
  if (canvas.error) return <BuildNotice status="failed" message={canvas.error} name={canvas.name} />;
  const frames = canvas.items.map((item) => `${item.id}:${item.width}x${item.height}`).join("\n");
  return <ConnectedCanvas key={frames} canvas={canvas} host={host} visible={visible} />;
};

const RecentCanvases = ({
  host,
  id,
  selected,
  visible,
}: {
  host: GuestHost;
  id: string;
  selected: boolean;
  visible: boolean;
}) => {
  const [recent, setRecent] = useState([id]);
  if (recent.at(-1) !== id) setRecent([recent[recent.length - 1], id]);

  // Keep DOM order stable on a return visit. Moving an iframe can restart its document.
  return [...recent].sort().map((source) => (
    <Box key={source} display={source === id ? "block" : "none"} h="full" minH="0">
      <CanvasPane host={host} id={source} visible={visible && source === id} selected={source === id && selected} />
    </Box>
  ));
};

export const CanvasRoot = (props: RootProps) => {
  const { host, propsStore } = props;
  const current = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
  const [theme, setTheme] = useState(() => readCanvasTheme(current.themePreference ?? "pstdio-light"));
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTheme(readCanvasTheme(current.themePreference ?? "pstdio-light")));
    return () => cancelAnimationFrame(frame);
  }, [current.themePreference]);
  const ownsContext =
    current.pageLocation?.page.extensionId === "pstdio.canvas" ||
    (current.resource?.type === "canvas" &&
      (!current.resource.extensionId || current.resource.extensionId === "pstdio.canvas"));
  // The shared placement receives empty resource props after Back to project. Keep its last
  // Canvas context mounted until another Canvas context replaces it, preserving preview drafts.
  const retained = useRef(current);
  if (ownsContext) retained.current = current;
  const location = retained.current.pageLocation;
  const onDesign = location?.page.extensionId === "pstdio.canvas" && location.page.id === canvasPage.id;
  const id = retained.current.resource?.id ?? (onDesign ? location.resource?.id : undefined);
  // A retained view keeps its own page location after the person leaves, so only a visible view
  // may replace a removed canvas; a hidden one would pull the person back from another page.
  const visible = useWebviewVisibility() && ownsContext;
  const active =
    visible &&
    location?.page.extensionId === "pstdio.canvas" &&
    ((location.page.id === homePage.id && !id) || (location.page.id === canvasPage.id && location.resource?.id === id));
  return (
    <CanvasThemeContext value={theme}>
      <CanvasThemeProvider>
        {id ? (
          <RecentCanvases
            key={retained.current.resource?.projectId ?? location?.resource?.projectId}
            host={host}
            id={id}
            selected={active}
            visible={visible}
          />
        ) : (
          <CanvasPane host={host} visible={visible} selected={active} />
        )}
      </CanvasThemeProvider>
    </CanvasThemeContext>
  );
};
