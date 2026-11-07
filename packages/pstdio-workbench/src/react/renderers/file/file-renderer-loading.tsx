import { Box } from "@chakra-ui/react";
import { MarkdownEditorSkeleton } from "@pstdio/ui/lazy-markdown-editor";

export const FileRendererLoading = () => (
  <Box w="full" h="full" minH="0" overflow="hidden" bg="bg">
    <MarkdownEditorSkeleton />
  </Box>
);
