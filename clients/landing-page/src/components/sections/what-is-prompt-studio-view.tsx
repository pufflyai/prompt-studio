import { Box, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { ChangeToolDemo, ConnectedToolsDemo, WorkbenchOverviewDemo } from "../examples/why-story-demos";
import { BuildingBlocks } from "./building-blocks";
import { ChapterCarousel } from "./chapter-carousel";

const REASONS = [
  {
    id: "building-blocks",
    label: "Building blocks",
    title: "The right building blocks to create extensions.",
    subtitle: "Give your agents the pieces they need to build useful tools.",
    Demo: BuildingBlocks,
  },
  {
    id: "editor",
    label: "A clean editor",
    title: "A clean editor out of the box.",
    subtitle: "Give your tools a consistent UI, with panels, navigation, and themes included.",
    Demo: WorkbenchOverviewDemo,
  },
  {
    id: "connected-tools",
    label: "Connected tools",
    title: "Connect the tools you build.",
    subtitle: "Use shared files and commands to connect your tools into workflows.",
    Demo: ConnectedToolsDemo,
  },
  {
    id: "make-it-yours",
    label: "Make it yours",
    title: "Tweak things to work your way.",
    subtitle: "Ask your coding agent to add a view or change how your tool works.",
    Demo: ChangeToolDemo,
  },
];

export const WhatIsPromptStudioView = () => {
  const [chapter, setChapter] = useState(REASONS[0].id);
  const styles = useStoryStyles();
  return (
    <ChapterCarousel
      label="What is Prompt Studio"
      value={chapter}
      onChange={setChapter}
      chapters={REASONS.map(({ id, label, title, subtitle, Demo }) => ({
        id,
        label,
        content: (
          <Box css={styles.page}>
            <Box as="section" css={styles.section}>
              <Stack css={styles.intro}>
                <Text as="h1" textStyle={{ base: "heading/M", md: "heading/L" }}>
                  {title}
                </Text>
                <Text textStyle="paragraph/L/regular" color="fg.muted">
                  {subtitle}
                </Text>
              </Stack>
              <Demo />
            </Box>
          </Box>
        ),
      }))}
    />
  );
};
