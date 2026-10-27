import { Box, Stack, Text } from "@chakra-ui/react";
import { Component, type ComponentType, type ReactNode, useEffect, useState } from "react";
import type { DocumentPreview, StoryPreview } from "./definitions";
import { PreviewSource } from "./source-information";

interface LoadedPreview {
  Component: ComponentType;
  args?: Record<string, unknown>;
  argTypes?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  hasPlay?: boolean;
}
const loads = new Map<string, Promise<LoadedPreview>>();
const load = (preview: StoryPreview | DocumentPreview) => {
  const key = `${preview.kind}:${preview.source}:${preview.kind === "story" ? preview.exportName : ""}`;
  let pending = loads.get(key);
  if (!pending) {
    pending = import("./generated/native-preview").then((module) => module.loadPreview(preview));
    loads.set(key, pending);
  }
  return pending;
};
class PreviewBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <Text role="alert" data-ui-canvas-error p="md" color="fg.error">
          {this.state.error}
        </Text>
      );
    return this.props.children;
  }
}
const inspect = (value: unknown) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "function") return `[callback ${item.name || "local"}]`;
      if (typeof item === "symbol") return String(item);
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[shared reference]";
        seen.add(item);
      }
      return item;
    },
    2,
  );
};
const PreviewInformation = (props: { preview: StoryPreview | DocumentPreview; loaded: LoadedPreview }) => {
  const { preview, loaded } = props;
  const [expanded, setExpanded] = useState(false);
  return (
    <Box
      as="details"
      p="md"
      borderTopWidth="1px"
      borderColor="border.subtle"
      onToggle={(event) => setExpanded(event.currentTarget.hasAttribute("open"))}
    >
      <Box as="summary" textStyle="label/S/medium">
        Props and source
      </Box>
      <Stack gap="sm" pt="sm">
        <Text textStyle="mono/XS" overflowWrap="anywhere">
          {preview.source}
          {preview.kind === "story" && `#${preview.exportName}`}
        </Text>
        {loaded.args && (
          <Box as="pre" textStyle="mono/XS" whiteSpace="pre-wrap" overflowWrap="anywhere">
            {inspect(loaded.args)}
          </Box>
        )}
        {loaded.argTypes && (
          <Box as="pre" textStyle="mono/XS" whiteSpace="pre-wrap" overflowWrap="anywhere">
            {inspect(loaded.argTypes)}
          </Box>
        )}
        {loaded.hasPlay && (
          <Text textStyle="paragraph/S/regular">Interaction validation: the source export's play function.</Text>
        )}
        {expanded && <PreviewSource source={preview.source} />}
      </Stack>
    </Box>
  );
};
export const CatalogPreviewFrame = (props: { preview: StoryPreview | DocumentPreview; name: string }) => {
  const { preview, name } = props;
  const [loaded, setLoaded] = useState<LoadedPreview>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    load(preview)
      .then((result) => {
        if (active) setLoaded(result);
      })
      .catch((error) => {
        if (active) setError(String(error));
      });
    return () => {
      active = false;
    };
  }, [preview]);
  if (error)
    return (
      <Text role="alert" data-ui-canvas-error p="md" color="fg.error">
        {error}
      </Text>
    );
  if (!loaded)
    return (
      <Text p="md" data-ui-canvas-loading>
        Loading {name}…
      </Text>
    );
  const Preview = loaded.Component;
  const docs = loaded.parameters?.docs as { description?: { story?: string } } | undefined;
  return (
    <PreviewBoundary>
      <Box data-ui-canvas-preview={preview.id}>
        {docs?.description?.story && (
          <Text p="md" textStyle="paragraph/M/regular" whiteSpace="pre-wrap">
            {docs.description.story}
          </Text>
        )}
        <Box
          display="grid"
          minH={
            preview.kind === "story" && loaded.parameters?.layout === "fullscreen"
              ? `${preview.viewportHeight}px`
              : undefined
          }
          data-ui-canvas-component
        >
          <Preview />
        </Box>
        <PreviewInformation preview={preview} loaded={loaded} />
      </Box>
    </PreviewBoundary>
  );
};
