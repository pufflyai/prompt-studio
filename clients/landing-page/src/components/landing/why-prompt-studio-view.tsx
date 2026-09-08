import { Box, Flex, Grid, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { Perch } from "../shapes/field-layout";
import { ShapeField } from "../shapes/shape-field";
import type { ToolShapeKind } from "../shapes/tool-shapes";
import { PageScroll } from "./page-scroll";

/**
 * Drawn from MISSION.md. Each title continues the one above it, so the page reads as a
 * single argument rather than a list of features. The tools perch on the end of every
 * title and drop to the next one when pushed off.
 */
const REASONS: { title: string; body: string; marks: ToolShapeKind[] }[] = [
  {
    title: "The plumbing is already running",
    body: "You never write auth, storage, or sync. A tool is handed a workspace to run in, somewhere to keep its data, and permissions that already hold.",
    marks: ["page", "command"],
  },
  {
    title: "So a new tool is small",
    body: "What you write is the part specific to your work: a page that lists something, a command that produces something. The rest is already there.",
    marks: ["hook"],
  },
  {
    title: "And each tool makes the next one cheaper",
    body: "Tools live in one place, so what one produces another can use. The second tool starts where the first one finished.",
    marks: ["command", "page"],
  },
  {
    title: "The same tool serves you and your agent",
    body: "Every command, page and editor is reachable by a person and by an agent, with the same permissions. You do not build an API for the agent and a UI for yourself.",
    marks: ["automation"],
  },
  {
    title: "Nothing we ship is privileged",
    body: "The planner, the reports, the agent harnesses: all extensions, on the same public interfaces yours will use. When one of ours needs a private API we treat the platform as broken rather than that tool as special.",
    marks: ["skill"],
  },
  {
    title: "And what you build stays yours",
    body: "Tools live in your repository, next to the code they act on. Hand one to a teammate, or publish it, and it keeps working.",
    marks: ["editor", "automation"],
  },
];

const samePerches = (left: Perch[], right: Perch[]) =>
  left.length === right.length &&
  left.every((perch, index) => {
    const other = right[index];
    return (
      Math.abs(perch.x - other.x) < 0.5 &&
      Math.abs(perch.y - other.y) < 0.5 &&
      Math.abs(perch.width - other.width) < 0.5
    );
  });

interface WhyPromptStudioViewProps {
  windowOffset?: { x: number; y: number };
}

export const WhyPromptStudioView = (props: WhyPromptStudioViewProps) => {
  const { windowOffset } = props;

  const fieldRef = useRef<HTMLDivElement>(null);
  const titleRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [perches, setPerches] = useState<Perch[]>([]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const measure = () => {
      const base = field.getBoundingClientRect();
      const measured = titleRefs.current.flatMap((title, index) => {
        if (!title) return [];
        const rect = title.getBoundingClientRect();
        return [{ x: rect.left - base.left, y: rect.top - base.top, width: rect.width, marks: REASONS[index].marks }];
      });

      setPerches((current) => (samePerches(current, measured) ? current : measured));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(field);
    for (const title of titleRefs.current) {
      if (title) observer.observe(title);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <PageScroll>
      <Box ref={fieldRef} position="relative" width="100%">
        <ShapeField spawn="parcour" perches={perches} worldOffset={windowOffset} />
        <Flex justify="center">
          {/* One reason per row, alternating sides, so a shape pushed off a title drops
              diagonally onto the next one. */}
          <Grid
            width="100%"
            maxWidth="1080px"
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
            columnGap="64px"
            rowGap={{ base: "44px", md: "32px" }}
            px="32px"
            pt="72px"
            pb="60px"
          >
            {REASONS.map((reason, index) => (
              <Stack
                key={reason.title}
                gap="10px"
                gridColumn={{ base: "1", md: index % 2 === 0 ? "1" : "2" }}
                gridRow={{ md: `${index + 1}` }}
              >
                <Text
                  as="h2"
                  ref={(element) => {
                    titleRefs.current[index] = element;
                  }}
                  fontFamily="heading"
                  fontSize={{ base: "24px", md: "28px" }}
                  fontWeight="semibold"
                  lineHeight="1.2"
                  letterSpacing="-0.4px"
                  width="fit-content"
                  maxWidth="100%"
                >
                  {reason.title}
                </Text>
                <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted">
                  {reason.body}
                </Text>
              </Stack>
            ))}
          </Grid>
        </Flex>
      </Box>
    </PageScroll>
  );
};
