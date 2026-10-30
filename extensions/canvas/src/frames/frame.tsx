import { Box, Text } from "@chakra-ui/react";
import { type ThemePreferenceOption, useThemePreference } from "@pstdio/ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvases/definitions";
import themes from "../catalog/generated/frame-themes.json";
import { PreviewSource } from "../catalog/source-information";
import { Button } from "../components/themed-primitives";
import type { CanvasRuntime } from "../controller/runtime";
import { type FrameBootstrap, frameBootstrap, frameDocument } from "./assets";
import { FrameLoading } from "./frame-loading";
import { navigateFrame } from "./navigation";
import { type FrameMessage, type FrameRequest, frameProtocol } from "./protocol";

const postFrame = (frame: HTMLIFrameElement | null, message: Omit<FrameRequest, "protocol">) =>
  frame?.contentWindow?.postMessage({ protocol: frameProtocol, ...message }, "*");
const validFrameMessage = (event: MessageEvent<FrameMessage>, frame: HTMLIFrameElement | null) =>
  event.source === frame?.contentWindow && event.data?.protocol === frameProtocol;
const sendCatalog = (frame: HTMLIFrameElement | null, nonce: string, source: string) => {
  void frameBootstrap(source).then(
    (bootstrap) => postFrame(frame, { nonce, type: "catalog", source, bootstrap }),
    (error) => postFrame(frame, { nonce, type: "catalog", source, error: String(error) }),
  );
};

const frameThemes = [...themes, { id: "pstdio-light", mode: "light" }, { id: "pstdio-dark", mode: "dark" }];

export const FramePreview = (props: { item: CanvasItem; runtime: CanvasRuntime }) => {
  const { item, runtime } = props;
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef(crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const [bootstrap, setBootstrap] = useState<FrameBootstrap>();
  const startup = useRef<ReturnType<typeof runtime.startup.enqueue>>(undefined);
  const source = item.preview?.source ?? `$native:${item.component}`;
  const [height, setHeight] = useState(item.height);
  const [information, setInformation] = useState<FrameMessage["information"]>();
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const selected = useSyncExternalStore(runtime.subscribe, () => runtime.get().themes[item.id] ?? "app");
  const app = useThemePreference();
  const appTheme = app.themePreferences.find((theme) => theme.id === app.themePreference);
  const theme = selected === "app" ? appTheme : frameThemes.find((theme) => theme.id === selected);
  const sentTheme = useRef<typeof theme>(undefined);
  useEffect(() => {
    let active = true;
    void frameBootstrap(source)
      .then((selected) => {
        if (active) setBootstrap(selected);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
      startup.current?.finish();
    };
  }, [source]);
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
        case "bootstrap": {
          const { scripts, styles, entry } = bootstrap!;
          startup.current = runtime.startup.enqueue(() =>
            postFrame(frame.current, { nonce: nonce.current, type: "bootstrap", assets: { scripts, styles, entry } }),
          );
          return;
        }
        case "boot":
          // Release before example setup, which can await nested previews.
          startup.current?.finish();
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
        case "catalog":
          sendCatalog(frame.current, nonce.current, message.source ?? "");
          break;
        case "height":
          if (Number.isFinite(message.height)) setHeight(Math.max(item.height, Math.min(message.height!, 100000)));
          break;
        case "loaded":
          setReady(true);
          setInformation(message.information);
          break;
        case "error":
          startup.current?.finish();
          setError(message.message ?? "Preview failed");
          break;
      }
      navigateFrame(message, item.id, runtime);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [bootstrap, theme, item, runtime]);
  return (
    <>
      {error && (
        <Text role="alert" data-ui-canvas-error>
          {error}
        </Text>
      )}
      {!ready && !error && <FrameLoading name={item.name} />}
      {bootstrap && (
        <iframe
          key={revision}
          ref={frame}
          title={item.name}
          srcDoc={frameDocument()}
          sandbox="allow-scripts allow-forms"
          data-frame-story={item.preview?.kind === "story" ? item.preview.id : undefined}
          data-ui-canvas-component
          data-frame-ready={ready || undefined}
          style={{ display: "block", width: "100%", height, border: 0 }}
        />
      )}
      <Button
        size="xs"
        variant="ghost-static"
        onClick={() => {
          startup.current?.finish();
          setError("");
          setReady(false);
          setInformation(undefined);
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
          {information?.argTypes && (
            <Box as="pre" whiteSpace="pre-wrap" overflowWrap="anywhere">
              {information.argTypes}
            </Box>
          )}
          {expanded && <PreviewSource source={item.preview.source} />}
        </Box>
      )}
    </>
  );
};
