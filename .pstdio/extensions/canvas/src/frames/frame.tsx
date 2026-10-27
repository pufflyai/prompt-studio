import { Box, Button, Text } from "@chakra-ui/react";
import { type ThemePreferenceOption, useThemePreference } from "@pstdio/ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CanvasItem } from "../canvases/definitions";
import themes from "../catalog/generated/frame-themes.json";
import { PreviewSource } from "../catalog/source-information";
import type { CanvasRuntime } from "../controller/runtime";
import { type FrameBootstrap, frameBootstrap, frameDocument } from "./assets";
import { navigateFrame } from "./navigation";
import { type FrameMessage, type FrameRequest, frameProtocol } from "./protocol";

const postFrame = (frame: HTMLIFrameElement | null, message: Omit<FrameRequest, "protocol">) =>
  frame?.contentWindow?.postMessage({ protocol: frameProtocol, ...message }, "*");
const validFrameMessage = (event: MessageEvent<FrameMessage>, frame: HTMLIFrameElement | null) =>
  event.source === frame?.contentWindow && event.data?.protocol === frameProtocol;

export const FramePreview = (props: { item: CanvasItem; runtime: CanvasRuntime }) => {
  const { item, runtime } = props;
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef(crypto.randomUUID());
  const [revision, setRevision] = useState(0);
  const [bootstrap, setBootstrap] = useState<FrameBootstrap>();
  const [height, setHeight] = useState(item.height);
  const [information, setInformation] = useState<FrameMessage["information"]>();
  const [expanded, setExpanded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const selected = useSyncExternalStore(runtime.subscribe, () => runtime.get().themes[item.id] ?? "app");
  const app = useThemePreference();
  const appTheme = app.themePreferences.find((theme) => theme.id === app.themePreference);
  const theme =
    selected === "app"
      ? appTheme
      : [...themes, { id: "pstdio-light", mode: "light" }, { id: "pstdio-dark", mode: "dark" }].find(
          (theme) => theme.id === selected,
        );
  useEffect(() => {
    void frameBootstrap()
      .then(setBootstrap)
      .catch((error) => setError(String(error)));
  }, []);
  useEffect(() => {
    if (ready) postFrame(frame.current, { nonce: nonce.current, type: "theme", theme: theme as ThemePreferenceOption });
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
          postFrame(frame.current, {
            nonce: nonce.current,
            type: "render",
            item,
            theme: theme as ThemePreferenceOption,
            bootstrap,
          });
          return;
      }
      if (message.nonce !== nonce.current) return;
      switch (message.type) {
        case "height":
          if (Number.isFinite(message.height)) setHeight(Math.max(item.height, Math.min(message.height!, 100000)));
          break;
        case "loaded":
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
  }, [bootstrap, theme, item, runtime]);
  return (
    <>
      {error && (
        <Text role="alert" data-ui-canvas-error>
          {error}
        </Text>
      )}
      {!ready && !error && <Text data-ui-canvas-loading>Loading {item.name}…</Text>}
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
      {item.preview && item.preview.kind !== "design" && (
        <Box as="details" p="sm" onToggle={(event) => setExpanded(event.currentTarget.hasAttribute("open"))}>
          <Box as="summary">Props and source</Box>
          <Text textStyle="mono/XS">
            {item.preview.source}
            {item.preview.kind === "story" && `#${item.preview.exportName}`}
          </Text>
          {information?.hasPlay && <Text>Interaction validation: the source export's play function.</Text>}
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
