import { Box, Button, Flex, Stack } from "@chakra-ui/react";
import { useRef, useState } from "react";
import { createWorkbenchPresence } from "../../../core/presence/workbench-presence";
import { FileRendererContentView } from "./file-renderer-content";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";
import { PublicMarkdownFileEditor } from "./public-markdown-file-editor";

const content = `# Project notes\n\n${Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}. Keep the editor steady while a notice appears.`).join("\n\n")}\n\nLast paragraph.`;

export const StickyFooter = () => {
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [presence] = useState(createWorkbenchPresence);
  const rendererRef = useRef<HTMLDivElement>(null);
  return (
    <Stack h="full" minH="0" gap="sm" p="md">
      <Flex gap="xs">
        <Button size="xs" onClick={() => setError(true)}>
          Show save failure
        </Button>
        <Button size="xs" onClick={() => setUnavailable(true)}>
          Open unavailable shared document
        </Button>
      </Flex>
      <Box flex="1" minH="0" data-testid="document-pane">
        {unavailable ? (
          <PublicMarkdownFileEditor
            open
            connect={() => {
              throw new Error("This shared document could not be opened.");
            }}
          />
        ) : (
          <FileRendererContentView
            content={{ content, fileName: "notes.md" }}
            presence={presence}
            open
            editorKey="notes"
            errorNotice={
              error ? (
                <FileRendererErrorNotice
                  message="Your edit could not be saved. Your draft is kept here."
                  onRetry={() => setError(false)}
                />
              ) : null
            }
            contributionCanSave
            onChange={() => {}}
            rendererRef={rendererRef}
            title="Project notes"
          />
        )}
      </Box>
    </Stack>
  );
};

export default {
  title: "Product/Workbench/File editor/Document notices",
  fullscreen: true,
  description:
    "Save errors remain below the scrolling document. Showing and dismissing a notice keeps the first line steady and the last paragraph reachable.",
};
