import { Box, Text, useInput } from "ink";
import Markdown from "ink-markdown";
import { useState } from "react";

interface MarkdownViewProps {
  title: string;
  content: string;
  width: number;
  viewportHeight: number;
}

// title (1) + marginBottom (1) + footer marginTop (1) + footer (1)
const CHROME_LINES = 4;

export function MarkdownView({ title, content, width, viewportHeight }: MarkdownViewProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const contentHeight = Math.max(1, viewportHeight - CHROME_LINES);
  const maxScroll = Math.max(0, content.split("\n").length - contentHeight);

  useInput((input, key) => {
    if (key.downArrow) {
      setScrollOffset((o) => Math.min(o + 1, maxScroll));
    } else if (key.upArrow) {
      setScrollOffset((o) => Math.max(0, o - 1));
    } else if (input === "g") {
      setScrollOffset(0);
    } else if (input === "G") {
      setScrollOffset(maxScroll);
    }
  });

  if (!content) {
    return (
      <Box height={viewportHeight} width={width} alignItems="center" justifyContent="center">
        <Text dimColor>No content for this document.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>

      <Box flexDirection="column" overflow="hidden" height={contentHeight}>
        <Box flexDirection="column" marginTop={-scrollOffset}>
          <Markdown>{content}</Markdown>
        </Box>
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>j/k:scroll g/G:top/bottom esc:close</Text>
      </Box>
    </Box>
  );
}
