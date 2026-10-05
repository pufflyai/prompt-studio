import { Box } from "@chakra-ui/react";
import { findSearchRanges } from "./collection-view-search";

export interface HighlightedTextProps {
  text: string;
  /** The view's search text. Every match in `text` is marked. */
  query: string;
}

export const HighlightedText = (props: HighlightedTextProps) => {
  const { text, query } = props;
  const ranges = findSearchRanges(text, query);
  if (ranges.length === 0) return text;
  const parts: Array<{ text: string; match: boolean; start: number }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false, start: cursor });
    parts.push({ text: text.slice(start, end), match: true, start });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false, start: cursor });

  return parts.map((part) =>
    part.match ? (
      <Box as="mark" key={part.start} bg="bg.warning" color="inherit" borderRadius="2xs">
        {part.text}
      </Box>
    ) : (
      part.text
    ),
  );
};
