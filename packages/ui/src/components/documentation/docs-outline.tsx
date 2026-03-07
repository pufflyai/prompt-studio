import { Box, Collapsible, HStack, Icon, Stack, Text, useEnvironmentContext } from "@chakra-ui/react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DocHeading {
  id: string;
  level: number;
  text: string;
}

interface HeadingElementsMatch {
  elementsByHeadingId: Map<string, HTMLElement>;
  headingIdByElement: Map<HTMLElement, string>;
}

export interface DocsOutlineProps {
  markdown: string;
  title?: string;
  rootMargin?: string;
}

interface DocsOutlineItemProps {
  heading: DocHeading;
  isActive: boolean;
  emphasized: boolean;
  variant: "line" | "minimal";
  onSelect: (headingId: string) => void;
}

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm;
const HEADING_SELECTOR = ".rich-text__h1, .rich-text__h2, .rich-text__h3";

const isHeadingLevelMatch = (element: Element, level: number) => {
  return element.classList.contains(`rich-text__h${level}`);
};

const slugifyHeading = (value: string) => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const extractHeadings = (markdown: string) => {
  const headings: DocHeading[] = [];
  let headingIndex = 0;

  for (const match of markdown.matchAll(HEADING_REGEX)) {
    const level = match[1]!.length;
    const text = match[2]!.trim();
    const slug = slugifyHeading(text);
    const id = `${slug || "heading"}-${headingIndex}`;

    headings.push({ id, level, text });
    headingIndex += 1;
  }

  return headings;
};

const matchHeadingElements = (headings: DocHeading[], doc: Document) => {
  const elements = Array.from(doc.querySelectorAll(HEADING_SELECTOR));
  const elementsByHeadingId = new Map<string, HTMLElement>();
  const headingIdByElement = new Map<HTMLElement, string>();
  let nextElementIndex = 0;

  for (const heading of headings) {
    for (let elementIndex = nextElementIndex; elementIndex < elements.length; elementIndex += 1) {
      const element = elements[elementIndex] as HTMLElement;
      const elementText = element.textContent?.trim();

      if (!elementText || elementText !== heading.text) {
        continue;
      }

      if (!isHeadingLevelMatch(element, heading.level)) {
        continue;
      }

      elementsByHeadingId.set(heading.id, element);
      headingIdByElement.set(element, heading.id);
      nextElementIndex = elementIndex + 1;
      break;
    }
  }

  return { elementsByHeadingId, headingIdByElement };
};

const DocsOutlineItem = (props: DocsOutlineItemProps) => {
  const { heading, isActive, emphasized, variant, onSelect } = props;
  const isLine = variant === "line";

  return (
    <Box
      as="button"
      py="1.5"
      px="0"
      width="full"
      display="flex"
      textAlign="left"
      textStyle="sm"
      cursor="pointer"
      textDecoration="none"
      transition="all 0.15s ease"
      paddingInlineStart={`calc(${heading.level} * 0.75rem)`}
      color={isActive ? "fg" : "fg.muted"}
      fontWeight={isActive || emphasized ? "medium" : "normal"}
      borderStartWidth={isLine ? "1px" : "0px"}
      borderStartColor={isLine ? (isActive ? "fg" : "bg.muted") : "transparent"}
      _hover={isLine ? { borderStartColor: "bg.emphasized" } : { color: "fg" }}
      onClick={() => onSelect(heading.id)}
    >
      {heading.text}
    </Box>
  );
};

export const DocsOutline = (props: DocsOutlineProps) => {
  const { markdown, title = "On this page", rootMargin = "-20% 0% -35% 0%" } = props;
  const headings = extractHeadings(markdown);
  const env = useEnvironmentContext();
  const [activeHeadingId, setActiveHeadingId] = useState(headings[0]?.id ?? "");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const headingElementsMatchRef = useRef<HeadingElementsMatch>({
    elementsByHeadingId: new Map(),
    headingIdByElement: new Map(),
  });

  useEffect(() => {
    const extractedHeadings = extractHeadings(markdown);
    setActiveHeadingId(extractedHeadings[0]?.id ?? "");
  }, [markdown]);

  useEffect(() => {
    const headingsForObserver = extractHeadings(markdown);
    const doc = env.getDocument();
    const win = env.getWindow();
    const nextMatch = matchHeadingElements(headingsForObserver, doc);

    headingElementsMatchRef.current = nextMatch;

    if (nextMatch.headingIdByElement.size === 0) {
      return;
    }

    const observer = new win.IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);

        if (visibleEntries.length === 0) {
          return;
        }

        const target = visibleEntries[0]!.target as HTMLElement;
        const nextActiveHeadingId = nextMatch.headingIdByElement.get(target);

        if (nextActiveHeadingId) {
          setActiveHeadingId(nextActiveHeadingId);
        }
      },
      { rootMargin },
    );

    for (const element of nextMatch.headingIdByElement.keys()) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [env, markdown, rootMargin]);

  if (headings.length === 0) {
    return null;
  }

  const activeHeading = headings.find((heading) => heading.id === activeHeadingId);

  const handleHeadingSelect = (headingId: string) => {
    const headingElement = headingElementsMatchRef.current.elementsByHeadingId.get(headingId);
    setActiveHeadingId(headingId);
    setIsMobileOpen(false);
    headingElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Stack gap="0" width="full">
      <Box hideFrom="md" px="4" py="2" w="full" bg="bg.subtle" borderWidth="1px">
        <Collapsible.Root open={isMobileOpen} onOpenChange={(details) => setIsMobileOpen(details.open)}>
          <Collapsible.Trigger width="full" display="flex" alignItems="center" justifyContent="space-between">
            <HStack>
              <Icon as={FileText} color="fg.subtle" />
              <Text textStyle="sm" fontWeight="medium" color="fg">
                {title}
              </Text>
              {!isMobileOpen ? (
                <>
                  <Icon as={ChevronRight} color="fg.subtle" />
                  <Text textStyle="sm" color="fg.muted">
                    {activeHeading?.text}
                  </Text>
                </>
              ) : null}
            </HStack>
            <Box transition="transform 0.2s" transform={isMobileOpen ? "rotate(180deg)" : "rotate(0deg)"}>
              <Icon as={ChevronDown} color="fg.subtle" />
            </Box>
          </Collapsible.Trigger>

          <Collapsible.Content>
            <Box mt="3" maxH="30vh" overflowY="auto">
              <Stack gap="0">
                {headings.map((heading) => (
                  <DocsOutlineItem
                    key={heading.id}
                    heading={heading}
                    variant="minimal"
                    emphasized={false}
                    isActive={activeHeadingId === heading.id}
                    onSelect={handleHeadingSelect}
                  />
                ))}
              </Stack>
            </Box>
          </Collapsible.Content>
        </Collapsible.Root>
      </Box>

      <Box hideBelow="md" top="6" width="xs" overflowY="auto" position="sticky" maxH="calc(100vh - 3rem)">
        <HStack mb="4">
          <Icon as={FileText} color="fg.subtle" />
          <Text fontWeight="medium" textStyle="sm">
            {title}
          </Text>
        </HStack>

        <Stack gap="0">
          {headings.map((heading) => (
            <DocsOutlineItem
              key={heading.id}
              heading={heading}
              variant="line"
              emphasized={heading.level === 1}
              isActive={activeHeadingId === heading.id}
              onSelect={handleHeadingSelect}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};
