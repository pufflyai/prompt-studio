import { Box, Button } from "@chakra-ui/react";
import { type ComponentType, useEffect, useState } from "react";
import { AlertMessage } from "@/components/primitives/alert";
import { installPrismGlobal } from "@/utils/prism";
import type { MarkdownEditorProps } from "./markdown-editor/markdown-editor";

type EditorLoadState =
  | { kind: "loading" }
  | { kind: "ready"; Editor: ComponentType<MarkdownEditorProps> }
  | { kind: "failed" };

export const LazyMarkdownEditor = (props: MarkdownEditorProps) => {
  const [state, setState] = useState<EditorLoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await installPrismGlobal();
        const module = await import("./markdown-editor/markdown-editor");
        if (!cancelled) setState({ kind: "ready", Editor: module.MarkdownEditor });
      } catch {
        if (!cancelled) setState({ kind: "failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "ready") {
    const { Editor } = state;
    return <Editor {...props} />;
  }
  if (state.kind === "failed") {
    return (
      <AlertMessage
        status="error"
        title="Could not load the editor"
        endElement={<Button onClick={() => window.location.reload()}>Reload</Button>}
      />
    );
  }

  return <Box minH="7rem" borderWidth="1px" borderColor="border" borderRadius="xs" />;
};
