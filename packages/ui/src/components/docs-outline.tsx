import { Box, Stack, Text } from "@chakra-ui/react";

interface DocHeading {
  level: number;
  text: string;
}

export interface DocsOutlineProps {
  markdown: string;
}

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm;

export const extractHeadings = (markdown: string) => {
  const headings: DocHeading[] = [];

  for (const match of markdown.matchAll(HEADING_REGEX)) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    headings.push({ level, text });
  }

  return headings;
};

const scrollToHeading = (text: string) => {
  const selectors = [".rich-text__h1", ".rich-text__h2", ".rich-text__h3"];
  const headingElements = document.querySelectorAll(selectors.join(", "));

  for (const el of headingElements) {
    if (el.textContent?.trim() === text) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
};

export const DocsOutline = (props: DocsOutlineProps) => {
  const { markdown } = props;
  const headings = extractHeadings(markdown);

  if (headings.length === 0) {
    return null;
  }

  return (
    <Stack gap="0" py="sm" px="md" width="52" minW="52" borderLeftWidth="1px" overflowY="auto">
      <Text textStyle="label/S/medium" color="fg.muted" pb="xs">
        On this page
      </Text>
      {headings.map((heading, index) => (
        <Box key={`${heading.text}-${index}`} pl={heading.level > 1 ? `${(heading.level - 1) * 12}px` : "0"} py="2px">
          <Text
            as="button"
            textAlign="left"
            textStyle="paragraph/XS/regular"
            color="fg.subtle"
            cursor="pointer"
            _hover={{ color: "fg" }}
            onClick={() => scrollToHeading(heading.text)}
          >
            {heading.text}
          </Text>
        </Box>
      ))}
    </Stack>
  );
};
