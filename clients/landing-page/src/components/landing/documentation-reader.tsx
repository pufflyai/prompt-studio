import { Box, Flex } from "@chakra-ui/react";
import { type MarkdownUrlResolver, RichMessage } from "@pstdio/ui/rich-text";
import type { MouseEvent } from "react";

interface DocumentationReaderProps {
  markdown: string;
  onNavigateDoc?: (path: string) => void;
  resolveMarkdownUrl?: MarkdownUrlResolver;
  resolvePathFromUrl?: (url: string) => string | undefined;
}

export const DocumentationReader = (props: DocumentationReaderProps) => {
  const { markdown, onNavigateDoc, resolveMarkdownUrl, resolvePathFromUrl } = props;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    const href = anchor?.getAttribute("href");
    const path = href && resolvePathFromUrl?.(href);
    if (!path || !onNavigateDoc) return;

    event.preventDefault();
    onNavigateDoc(path);
  };

  return (
    <Flex height="100%" minHeight="0" justify="center" overflow="hidden" onClick={handleClick}>
      <Box width="100%" maxWidth="52rem" height="100%" minHeight="0" px={{ base: "20px", md: "32px" }} py="32px">
        <RichMessage defaultState={markdown} fullWidth resolveMarkdownUrl={resolveMarkdownUrl} />
      </Box>
    </Flex>
  );
};
