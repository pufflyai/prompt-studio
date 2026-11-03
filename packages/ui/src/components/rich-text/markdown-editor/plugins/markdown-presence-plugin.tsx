import { Box, useSlotRecipe } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import type { MarkdownCollaboration } from "./markdown-collaboration-plugin";
import { measureMarkdownPresence, type PresenceMarker } from "./markdown-presence-geometry";

interface MarkdownPresencePluginProps {
  collaboration: MarkdownCollaboration;
  source: MarkdownSourceDocument;
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
  containerRef: RefObject<HTMLDivElement | null>;
}
/** Remote ranges are painted above the document, never inserted into its editable DOM. */
export const MarkdownPresencePlugin = (props: MarkdownPresencePluginProps) => {
  const { collaboration, source, bindingRef, containerRef } = props;
  const [editor] = useLexicalComposerContext();
  const styles = useSlotRecipe({ key: "documentPresence" })({});
  const participants = useRef(collaboration.participants);
  const [markers, setMarkers] = useState<PresenceMarker[]>([]);
  const refresh = useRef(() => {});
  useEffect(() => {
    let frame: number | undefined;
    let disposed = false;
    const measure = () => {
      frame = undefined;
      const container = containerRef.current;
      const root = editor.getRootElement();
      const binding = bindingRef.current;
      if (!container || !root || !binding || !participants.current?.length) {
        setMarkers([]);
        return;
      }
      const next = editor.getEditorState().read(() =>
        measureMarkdownPresence({
          editor,
          source,
          binding,
          container,
          root,
          participants: participants.current ?? [],
        }),
      );
      setMarkers(next);
    };
    const schedule = () => {
      if (!disposed) frame ??= requestAnimationFrame(measure);
    };
    refresh.current = schedule;
    const stopUpdates = editor.registerUpdateListener(schedule);
    const resize = new ResizeObserver(schedule);
    const stopRoot = editor.registerRootListener((root, previous) => {
      if (previous) resize.unobserve(previous);
      if (root) resize.observe(root);
      schedule();
    });
    if (containerRef.current) resize.observe(containerRef.current);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    void document.fonts.ready.then(schedule);
    schedule();
    return () => {
      disposed = true;
      refresh.current = () => {};
      stopUpdates();
      stopRoot();
      resize.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [editor, source, bindingRef, containerRef]);
  useEffect(() => {
    participants.current = collaboration.participants;
    refresh.current();
  }, [collaboration.participants]);
  return (
    <Box aria-hidden="true" css={styles.overlay} data-markdown-presence>
      {markers.map(({ participant, caret, selected, labelWidth, labelRight, labelBelow }) => (
        <Box key={participant.id} colorPalette={participant.color}>
          {selected.map((rect, index) => (
            <Box
              key={`${index}:${rect.left}:${rect.top}`}
              css={styles.selection}
              style={rect}
              data-remote-selection={participant.id}
            />
          ))}
          <Box
            css={styles.caret}
            style={{ left: caret.left, top: caret.top, height: caret.height }}
            data-remote-caret={participant.id}
          >
            <Box
              css={styles.flag}
              style={{
                maxWidth: labelWidth,
                left: labelRight ? undefined : 0,
                right: labelRight ? 0 : undefined,
                top: labelBelow ? 0 : undefined,
                bottom: labelBelow ? undefined : "100%",
              }}
            >
              {participant.label}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
