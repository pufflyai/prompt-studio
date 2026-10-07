// Load a linked prototype from its owner and fit an isolated preview to its container.
import { Box, Button, chakra, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { PlanRow } from "../contracts";
import type { PlanClient } from "./use-plan";
import { useSize } from "./use-size";

// Previews can run self-contained prototype scripts, but cannot contact a server or reach the host.
export function previewDocument(html: string, theme: string) {
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
  return `<meta http-equiv="Content-Security-Policy" content="${policy}"><style>:root{${theme}}body{margin:0;background:var(--artifact-bg);color:var(--artifact-fg);font-family:var(--artifact-font)}</style>${html}`;
}

function previewTheme(element: HTMLElement) {
  const style = getComputedStyle(element);
  const colors = {
    bg: "bg",
    surface: "bg-subtle",
    fg: "fg",
    muted: "fg-muted",
    border: "border",
    accent: "border-accent",
  };
  return [
    ...Object.entries(colors).map(
      ([key, token]) => `--artifact-${key}:${style.getPropertyValue(`--chakra-colors-${token}`)}`,
    ),
    `--artifact-font:${style.fontFamily}`,
    `color-scheme:${style.colorScheme}`,
  ].join(";");
}

export function ArtifactPreview({ row, client, onOpen }: { row: PlanRow; client: PlanClient; onOpen: () => void }) {
  const { ref, width } = useSize();
  const [theme, setTheme] = useState("");
  const [html, setHtml] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const sync = () => {
      if (ref.current) {
        setTheme(previewTheme(ref.current));
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, [ref]);
  const available = row.artifact?.available;
  useEffect(() => {
    let active = true;
    setHtml(undefined);
    setError(undefined);
    if (available) {
      void client.commands["artifact.preview"]({ ticket: row.id })
        .then((preview) => {
          if (active) {
            setHtml(preview.html);
          }
        })
        .catch((reason) => {
          if (active) {
            setError(String(reason));
          }
        });
    }
    return () => {
      active = false;
    };
  }, [client, row.id, available]);

  let placeholder = available ? "Loading preview…" : "Artifact unavailable";
  if (error) {
    placeholder = "Preview unavailable";
  }
  return (
    <Box
      ref={ref}
      position="relative"
      mt="1"
      w="full"
      aspectRatio={8 / 5}
      overflow="hidden"
      borderRadius="sm"
      bg="bg.subtle"
    >
      {html ? (
        <chakra.iframe
          title={`${row.artifact?.title} preview`}
          srcDoc={previewDocument(html, theme)}
          sandbox="allow-scripts"
          loading="lazy"
          tabIndex={-1}
          pointerEvents="none"
          w="960px"
          h="600px"
          border="0"
          transform={`scale(${width / 960})`}
          transformOrigin="top left"
        />
      ) : (
        <Text p="xs" textStyle="label/XS/regular" color="fg.muted">
          {placeholder}
        </Text>
      )}
      {available ? (
        <Button
          data-canvas-control
          position="absolute"
          right="1"
          bottom="1"
          size="2xs"
          variant="solid"
          aria-label={`Open artifact ${row.artifact?.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          Open artifact
        </Button>
      ) : null}
    </Box>
  );
}
