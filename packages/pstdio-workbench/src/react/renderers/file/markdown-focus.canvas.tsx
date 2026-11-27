import { Box, Button, Input, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { LazyMarkdownEditor } from "@pstdio/ui/lazy-markdown-editor";
import { useEffect, useRef, useState } from "react";

const MarkdownFocus = () => {
  const [state, setState] = useState<"closed" | "loading" | "ready">("closed");
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state !== "loading") return;
    const handle = setTimeout(() => setState("ready"), 1200);
    return () => clearTimeout(handle);
  }, [state]);
  return (
    <Stack w="full" maxW="3xl">
      <Stack direction="row">
        <Button
          onClick={() => {
            panel.current?.focus();
            setState("loading");
          }}
        >
          Open note
        </Button>
        <Input aria-label="Another field" placeholder="Another field" />
      </Stack>
      <Box ref={panel} tabIndex={-1} h="64">
        {state === "loading" && "Opening note…"}
        {state === "ready" && (
          <LazyMarkdownEditor
            focusOnOpen={(root) => root.ownerDocument.activeElement === panel.current}
            defaultState=""
            isEditable
          />
        )}
      </Box>
    </Stack>
  );
};

export default {
  title: "Product/Workbench/File editor/Markdown focus",
  component: MarkdownFocus,
} satisfies CanvasMeta;

export const StartTyping: CanvasFrame = {
  description:
    "Open a note and start typing when it appears. Focus the other field while the note opens to keep typing there.",
};
