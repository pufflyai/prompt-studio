import { Box, Text } from "@chakra-ui/react";
import { type FrameBootstrap, type FrameMessage, type FrameRequest, frameProtocol } from "@pstdio/canvas";
import { useThemePreference } from "@pstdio/ui";
import { lazy, type RefObject, Suspense, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvas-model";
import { Button } from "../components/themed-primitives";
import type { CanvasRuntime } from "../controller/runtime";
import { frameThemeOption, resolveFrameTheme } from "../frame-themes";
import { readParameters, type Values } from "../parameters/model";
import { frameDocument } from "./assets";
import { FrameLoaderContext } from "./frame-loader";
import { FrameLoading } from "./frame-loading";
import { navigateFrame } from "./navigation";
import { useFrameStartup } from "./use-frame-startup";

const ParameterMenu = lazy(() =>
  import("../parameters/menu").then(({ ParameterMenu }) => ({ default: ParameterMenu })),
);

type ParameterRequest = Omit<FrameRequest, "type" | "protocol"> & {
  type: FrameRequest["type"] | "args";
  args?: Values;
};
const postFrame = (frame: HTMLIFrameElement | null, message: ParameterRequest) =>
  frame?.contentWindow?.postMessage({ protocol: frameProtocol, ...message }, "*");
const validFrameMessage = (event: MessageEvent<FrameMessage>, frame: HTMLIFrameElement | null) =>
  event.source === frame?.contentWindow && event.data?.protocol === frameProtocol;

interface FramePreviewProps {
  item: CanvasItem;
  runtime: CanvasRuntime;
  container: RefObject<HTMLElement | null>;
  selected: boolean;
}
export const FramePreview = (props: FramePreviewProps) => {
  const { item, runtime, container, selected: frameSelected } = props;
  const frameBootstrap = useContext(FrameLoaderContext);
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef(crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const { started, queuedAt, startedAt, job } = useFrameStartup(runtime.startup, container, frameSelected, revision);
  const assetsMs = useRef(0);
  const [timings, setTimings] = useState<Record<string, number>>();
  const [bootstrap, setBootstrap] = useState<FrameBootstrap>();
  const [height, setHeight] = useState(item.height);
  const [information, setInformation] = useState<FrameMessage["information"]>();
  const [parameters, setParameters] = useState<ReturnType<typeof readParameters>>();
  const [ready, setReady] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");
  const selected = useSyncExternalStore(runtime.subscribe, () =>
    resolveFrameTheme(runtime.get().themes[item.id], item.preview.defaultTheme),
  );
  const app = useThemePreference();
  const appTheme = app.themePreferences.find((theme) => theme.id === app.themePreference);
  const theme = frameThemeOption(selected, appTheme);
  const themeKey = JSON.stringify(theme);
  const sentTheme = useRef<string | undefined>(undefined);
  const { source, exportName, viewportHeight, revision: build } = item.preview;
  useEffect(() => {
    if (!started) return;
    let active = true;
    const begin = performance.now();
    void frameBootstrap(source, build)
      .then((data) => {
        if (!active) return;
        assetsMs.current = performance.now() - begin;
        setBootstrap(data);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [frameBootstrap, source, build, started]);
  useEffect(() => {
    if (ready || error) job.current?.finish();
  }, [ready, error, job]);
  useEffect(() => {
    if (!ready || sentTheme.current === themeKey) return;
    sentTheme.current = themeKey;
    postFrame(frame.current, { nonce: nonce.current, type: "theme", theme });
  }, [theme, themeKey, ready]);
  useEffect(() => {
    const receive = (event: MessageEvent<FrameMessage>) => {
      const message = event.data;
      if (!validFrameMessage(event, frame.current)) return;
      switch (message.type) {
        case "bootstrap":
          postFrame(frame.current, { nonce: nonce.current, type: "bootstrap", bootstrap });
          return;
        case "boot":
          sentTheme.current = themeKey;
          postFrame(frame.current, {
            nonce: nonce.current,
            type: "render",
            item: { preview: { source, exportName, viewportHeight } },
            theme,
          });
          return;
      }
      if (message.nonce !== nonce.current) return;
      switch (message.type) {
        case "imports-ready":
          // Bound module imports, then release before setup can await nested previews.
          job.current?.finish();
          setImported(true);
          break;
        case "painted":
          setTimings((current) => ({ ...current, ...message.timings }));
          break;
        case "assets":
          void frameBootstrap(message.source!).then(
            (data) =>
              postFrame(frame.current, {
                nonce: nonce.current,
                type: "assets",
                requestId: message.requestId,
                bootstrap: data,
              }),
            (error) =>
              postFrame(frame.current, {
                nonce: nonce.current,
                type: "assets",
                requestId: message.requestId,
                error: String(error),
              }),
          );
          break;
        case "height":
          if (Number.isFinite(message.height)) setHeight(Math.max(item.height, Math.min(message.height!, 100000)));
          break;
        case "loaded":
          setTimings({
            ...message.timings,
            queueMs: startedAt.current - queuedAt.current,
            assetsMs: assetsMs.current,
            totalMs: performance.now() - queuedAt.current,
          });
          setReady(true);
          setInformation(message.information);
          setParameters(readParameters(message.information));
          break;
        case "error":
          setError(message.message ?? "Preview failed");
          break;
      }
      navigateFrame(message, item.id, runtime);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [
    bootstrap,
    frameBootstrap,
    theme,
    themeKey,
    source,
    exportName,
    viewportHeight,
    item,
    runtime,
    startedAt,
    queuedAt,
    job,
  ]);
  let phase = "queued";
  if (started) phase = "loading";
  if (imported) phase = "setup";
  if (ready) phase = "ready";
  if (error) phase = "error";
  return (
    <Box data-ui-canvas-frame data-frame-startup={phase}>
      {parameters && (Object.keys(parameters.controls).length > 0 || parameters.motion) && (
        <Suspense fallback={null}>
          <ParameterMenu
            item={item}
            parameters={parameters}
            restoreTheme={(theme) => {
              if (!runtime.get().themes[item.id]) runtime.setTheme(item.id, theme);
            }}
            onChange={(args) => postFrame(frame.current, { nonce: nonce.current, type: "args", args })}
          />
        </Suspense>
      )}
      {error && (
        <Text role="alert" data-ui-canvas-error>
          {error}
        </Text>
      )}
      {!ready && !error && <FrameLoading name={item.name} />}
      {started && bootstrap && (
        <iframe
          key={revision}
          ref={frame}
          title={item.name}
          srcDoc={frameDocument()}
          sandbox="allow-scripts allow-forms"
          data-frame-story={`${source}#${exportName}`}
          data-ui-canvas-component
          data-frame-ready={ready || undefined}
          data-frame-modules={Object.keys(bootstrap.scripts).length}
          data-frame-bytes={[...Object.values(bootstrap.scripts), ...bootstrap.styles].reduce(
            (total, blob) => total + blob.size,
            0,
          )}
          data-frame-timings={timings ? JSON.stringify(timings) : undefined}
          style={{ display: "block", width: "100%", height, border: 0 }}
        />
      )}
      <Button
        size="xs"
        variant="ghost-static"
        onClick={() => {
          setError("");
          setReady(false);
          setImported(false);
          setInformation(undefined);
          setParameters(undefined);
          setBootstrap(undefined);
          setTimings(undefined);
          setHeight(item.height);
          nonce.current = crypto.randomUUID();
          setRevision((value) => value + 1);
        }}
      >
        Reset frame
      </Button>
      <Box as="details" p="sm">
        <Box as="summary">Props and source</Box>
        <Text textStyle="mono/XS">
          {source}#{exportName}
        </Text>
        {information?.description && <Text>{information.description}</Text>}
        {information?.args && (
          <Box as="pre" whiteSpace="pre-wrap" overflowWrap="anywhere">
            {information.args}
          </Box>
        )}
      </Box>
    </Box>
  );
};
