import { Box, Link, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { FittedDemo } from "../../hooks/use-fitted-demo";
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
    guide: "/docs/guides/concepts/extensions/",
    guideLabel: "Read about extensions",
  },
  {
    id: "editor",
    label: "A clean editor",
    title: "A clean editor out of the box.",
    subtitle: "Give your tools a consistent UI, with panels, navigation, and themes included.",
    Demo: WorkbenchOverviewDemo,
    guide: "/docs/guides/extensions/workbench-cookbook/",
    guideLabel: "Build pages and panels",
  },
  {
    id: "connected-tools",
    label: "Connected tools",
    title: "Connect the tools you build.",
    subtitle: "Use shared files and commands to connect your tools into workflows.",
    Demo: ConnectedToolsDemo,
    guide: "/docs/guides/extensions/cli-ready-actions/",
    guideLabel: "Connect tool actions",
  },
  {
    id: "make-it-yours",
    label: "Make it yours",
    title: "Tweak things to work your way.",
    subtitle: "Ask your coding agent to add a view or change how your tool works.",
    Demo: ChangeToolDemo,
    guide: "/docs/guides/getting-started/add-tools/#ask-an-agent-to-build-your-tool",
    guideLabel: "Build your first tool",
  },
];

export const HowDoesItWorkView = () => (
  <FittedDemo>
    <HowChapters />
  </FittedDemo>
);

const HowChapters = () => {
  const [chapter, setChapter] = useState(REASONS[0].id);
  const styles = useStoryStyles();
  return (
    <ChapterCarousel
      label="How does it work"
      value={chapter}
      onChange={setChapter}
      chapters={REASONS.map(({ id, label, title, subtitle, Demo, guide, guideLabel }) => ({
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
              <Link href={guide} alignSelf="start">
                {guideLabel}
              </Link>
            </Box>
          </Box>
        ),
      }))}
    />
  );
};
