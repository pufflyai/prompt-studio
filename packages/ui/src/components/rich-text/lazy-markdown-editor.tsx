import { Box } from "@chakra-ui/react";
import { type ComponentType, useEffect, useState } from "react";
import { installPrismGlobal } from "@/utils/prism";
import type { MarkdownEditorProps } from "./markdown-editor/markdown-editor";

export const LazyMarkdownEditor = (props: MarkdownEditorProps) => {
  const [Editor, setEditor] = useState<ComponentType<MarkdownEditorProps> | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await installPrismGlobal();
      const module = await import("./markdown-editor/markdown-editor");
      if (!cancelled) setEditor(() => module.MarkdownEditor);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!Editor) return <Box minH="7rem" borderWidth="1px" borderColor="border" borderRadius="xs" />;

  return <Editor {...props} />;
};
