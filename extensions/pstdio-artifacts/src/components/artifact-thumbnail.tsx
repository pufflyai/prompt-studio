import { Box, Center } from "@chakra-ui/react";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { createGlyphIcon } from "@pstdio/ui";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ArtifactSummary } from "../artifacts";
import { useArtifactTranslations } from "../translations";
import { HtmlPreview } from "./html-preview";

const FileCodeIcon = createGlyphIcon("document-code");
export type LoadArtifactPreview = (item: ArtifactSummary, signal: AbortSignal) => Promise<string>;

export const ArtifactThumbnail = (props: { item: ArtifactSummary; loadPreview: LoadArtifactPreview }) => {
  const { item, loadPreview } = props;
  const visible = useWebviewVisibility();
  const { t } = useArtifactTranslations();
  const container = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string>();
  const readPreview = useEffectEvent((revision: ArtifactSummary, signal: AbortSignal) => loadPreview(revision, signal));
  useEffect(() => {
    if (!visible) return;
    const abort = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (abort.signal.aborted || !entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void readPreview(item, abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setHtml(value);
        })
        .catch(() => {});
    });
    if (container.current) observer.observe(container.current);
    return () => {
      abort.abort();
      observer.disconnect();
    };
  }, [item, visible]);

  return (
    <Box
      ref={container}
      aspectRatio={16 / 10}
      overflow="hidden"
      bg="bg.muted"
      aria-hidden="true"
      inert
      pointerEvents="none"
    >
      {html === undefined ? (
        <Center height="full" color="fg.muted">
          <FileCodeIcon />
        </Center>
      ) : (
        // Render at four times the card viewport so the thumbnail shows a desktop page.
        <Box width="400%" height="400%" transform="scale(0.25)" transformOrigin="top left">
          <HtmlPreview html={html} title={t("library.thumbnail", "Thumbnail: {{title}}", { title: item.title })} />
        </Box>
      )}
    </Box>
  );
};
