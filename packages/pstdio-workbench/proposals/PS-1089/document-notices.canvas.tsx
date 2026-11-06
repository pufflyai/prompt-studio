import { Box, Button, Flex, Stack } from "@chakra-ui/react";
import { LazyMarkdownEditor } from "@pstdio/ui/rich-text";
import { useState } from "react";
import { FileRendererErrorNotice } from "./file-renderer-error-notice";

const content = `# Project notes\n\n${Array.from({ length: 30 }, (_, index) => `Paragraph ${index + 1}. Keep the editor steady while a notice appears.`).join("\n\n")}\n\nLast paragraph.`;

export const StickyFooter = () => {
  const [notice, setNotice] = useState("");
  return (
    <Stack h="full" minH="0" gap="sm" p="md">
      <Flex gap="xs" wrap="wrap">
        <Button size="xs" onClick={() => setNotice("Your edit could not be saved. Your draft is kept here.")}>
          Save failure
        </Button>
        <Button size="xs" onClick={() => setNotice("This document is read only.")}>
          Read only
        </Button>
        <Button
          size="xs"
          onClick={() =>
            setNotice("This resource was removed. Your draft is kept here. Copy it before closing this tab.")
          }
        >
          Removed resource
        </Button>
      </Flex>
      <Flex direction="column" flex="1" minH="0" bg="bg">
        <Box flex="1" minH="0">
          <LazyMarkdownEditor defaultState={content} isEditable />
        </Box>
        {notice && <FileRendererErrorNotice message={notice} onRetry={() => setNotice("")} />}
      </Flex>
    </Stack>
  );
};

export default {
  title: "Proposals/PS-1089 Document notices at the bottom",
  fullscreen: true,
  description:
    "Keep notices below the scrolling document. Showing a notice leaves the first line in place; Retry stays visible at the bottom.",
};
