import { Box, Stack, Text } from "@chakra-ui/react";
import { useStoryStyles } from "./building-blocks";
import { PageScroll } from "./page-scroll";
import { ChangeToolDemo, ConnectedToolsDemo, WorkbenchOverviewDemo } from "./why-story-demos";

const REASONS = [
  {
    title: "All your vibe coded tools under one roof.",
    Demo: WorkbenchOverviewDemo,
  },
  {
    title: "Connect the tools you build to fit your workflows.",
    Demo: ConnectedToolsDemo,
  },
  {
    title: "Make it work your way.",
    Demo: ChangeToolDemo,
  },
];

export const WhyPromptStudioView = () => {
  const styles = useStoryStyles();
  return (
    <PageScroll>
      <Box css={styles.page}>
        {REASONS.map(({ title, Demo }, index) => (
          <Box as="section" css={styles.section} key={title}>
            <Stack css={styles.intro}>
              <Text as={index === 0 ? "h1" : "h2"} textStyle={{ base: "heading/M", md: "heading/L" }}>
                {title}
              </Text>
            </Stack>
            <Demo />
          </Box>
        ))}
        <Text css={styles.caption}>
          Your tools live in your repository. Keep changing them and share what you build.
        </Text>
      </Box>
    </PageScroll>
  );
};
