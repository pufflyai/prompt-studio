import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import type { Perch } from "../shapes/field-layout";
import { ShapeField } from "../shapes/shape-field";
import { PageScroll } from "./page-scroll";
import { REASONS } from "./why-prompt-studio-content";

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
          <Stack width="full" maxWidth="2xl" gap="4xl" px="xl" pt="4xl" pb="4xl">
            {REASONS.map((reason, index) => (
              <Stack key={reason.title} gap="sm">
                <Text
                  as="h2"
                  ref={(element) => {
                    titleRefs.current[index] = element;
                  }}
                  textStyle="heading/M"
                  width="fit-content"
                  maxWidth="100%"
                >
                  {reason.title}
                </Text>
                <Text textStyle="paragraph/M/regular" color="fg.muted">
                  {reason.body}
                </Text>
              </Stack>
            ))}
          </Stack>
        </Flex>
      </Box>
    </PageScroll>
  );
};
