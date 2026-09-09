import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { ChangeToolDemo, ConnectedToolsDemo, WorkbenchOverviewDemo } from "../examples/why-story-demos";
import { PageScroll } from "../workbench/page-scroll";
import { BuildingBlocks } from "./building-blocks";

const REASONS = [
  {
    title: "The right building blocks to create extensions.",
    subtitle: "Give your agents the pieces they need to build useful tools.",
    Demo: BuildingBlocks,
  },
  {
    title: "A clean editor out of the box.",
    subtitle: "Give your tools a consistent UI, with panels, navigation, and themes included.",
    Demo: WorkbenchOverviewDemo,
  },
  {
    title: "Connect the tools you build.",
    subtitle: "Use shared files and commands to connect your tools into workflows.",
    Demo: ConnectedToolsDemo,
  },
  {
    title: "Tweak things to work your way.",
    subtitle: "Ask your coding agent to add a view or change how your tool works.",
    Demo: ChangeToolDemo,
  },
];

export const WhatIsPromptStudioView = (props: { footer: ReactNode }) => {
  const { footer } = props;
  const styles = useStoryStyles("spacious");
  return (
    <PageScroll>
      <Box css={styles.page}>
        {REASONS.map(({ title, subtitle, Demo }, index) => (
          <Box as="section" css={styles.section} key={title}>
            <Stack css={styles.intro}>
              <Text as={index === 0 ? "h1" : "h2"} textStyle={{ base: "heading/M", md: "heading/L" }}>
                {title}
              </Text>
              <Text textStyle="paragraph/L/regular" color="fg.muted">
                {subtitle}
              </Text>
            </Stack>
            <Demo />
          </Box>
        ))}
        {footer}
      </Box>
    </PageScroll>
  );
};
