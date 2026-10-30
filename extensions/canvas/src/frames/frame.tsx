import { Box, Text } from "@chakra-ui/react";
import { type ThemePreferenceOption, useThemePreference } from "@pstdio/ui";
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvases/definitions";
import { PreviewSource } from "../catalog/source-information";
import { Button } from "../components/themed-primitives";
import type { CanvasRuntime } from "../controller/runtime";
import { frameThemePreferences, resolveFrameTheme } from "../frame-themes";
import { type FrameBootstrap, frameBootstrap, frameDocument } from "./assets";
import { FrameLoading } from "./frame-loading";
import { navigateFrame } from "./navigation";
import { type FrameMessage, type FrameRequest, frameProtocol } from "./protocol";
import { useFrameStartup } from "./use-frame-startup";

const postFrame = (frame: HTMLIFrameElement | null, message: Omit<FrameRequest, "protocol">) =>
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
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef(crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const { started, queuedAt, startedAt, job } = useFrameStartup(runtime.startup, container, frameSelected, revision);
  const assetsMs = useRef(0);
  const [timings, setTimings] = useState<Record<string, number>>();
  const [bootstrap, setBootstrap] = useState<FrameBootstrap>();
  const [height, setHeight] = useState(item.height);
  const [information, setInformation] = useState<FrameMessage["information"]>();
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");
  const selected = useSyncExternalStore(runtime.subscribe, () =>
    resolveFrameTheme(
      runtime.get().themes[item.id],
      item.preview?.kind === "story" ? item.preview.defaultTheme : undefined,
    ),
  );
  const app = useThemePreference();
  const appTheme = app.themePreferences.find((theme) => theme.id === app.themePreference);
  const theme = selected === "app" ? appTheme : frameThemePreferences.find((theme) => theme.id === selected);
  const sentTheme = useRef<typeof theme>(undefined);
  const source = item.preview?.source ?? `$native:${item.component}`;
  useEffect(() => {
    if (!started) return;
    let active = true;
    const begin = performance.now();
    void frameBootstrap(source)
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
  }, [source, started]);
  useEffect(() => {
    if (ready || error) job.current?.finish();
  }, [ready, error, job]);
  useEffect(() => {
    if (!ready || sentTheme.current === theme) return;
    sentTheme.current = theme;
    postFrame(frame.current, { nonce: nonce.current, type: "theme", theme: theme as ThemePreferenceOption });
  }, [theme, ready]);
  useEffect(() => {
    const receive = (event: MessageEvent<FrameMessage>) => {
      const message = event.data;
      if (!validFrameMessage(event, frame.current)) return;
      switch (message.type) {
        case "bootstrap":
          postFrame(frame.current, { nonce: nonce.current, type: "bootstrap", bootstrap });
          return;
        case "boot":
          // Release before fixture setup, which can await nested previews.
          job.current?.finish();
          sentTheme.current = theme;
          postFrame(frame.current, {
            nonce: nonce.current,
            type: "render",
            item,
            theme: theme as ThemePreferenceOption,
          });
          return;
      }
      if (message.nonce !== nonce.current) return;
      switch (message.type) {
        case "imports-ready":
          // Let the next imports start without waiting for a React commit.
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
          break;
        case "error":
          setError(message.message ?? "Preview failed");
          break;
      }
      navigateFrame(message, item.id, runtime);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [bootstrap, theme, item, runtime, startedAt, queuedAt, job]);
  let phase = "queued";
  if (started) phase = "loading";
  if (imported) phase = "setup";
  if (ready) phase = "ready";
  if (error) phase = "error";
  return (
    <Box data-ui-canvas-frame data-frame-startup={phase}>
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
          data-frame-story={item.preview?.kind === "story" ? item.preview.id : undefined}
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
          setBootstrap(undefined);
          setTimings(undefined);
          setHeight(item.height);
          nonce.current = crypto.randomUUID();
          setRevision((value) => value + 1);
        }}
      >
        Reset frame
      </Button>
      {item.preview && (
        <Box as="details" p="sm" onToggle={(event) => setExpanded(event.currentTarget.hasAttribute("open"))}>
          <Box as="summary">Props and source</Box>
          <Text textStyle="mono/XS">
            {item.preview.source}
            {item.preview.kind === "story" && `#${item.preview.exportName}`}
          </Text>
          {information?.description && <Text>{information.description}</Text>}
          {information?.args && (
            <Box as="pre" whiteSpace="pre-wrap" overflowWrap="anywhere">
              {information.args}
            </Box>
          )}
          {expanded && <PreviewSource source={item.preview.source} />}
        </Box>
      )}
    </Box>
  );
};
