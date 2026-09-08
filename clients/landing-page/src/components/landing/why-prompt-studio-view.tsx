import { Box, Stack, Text } from "@chakra-ui/react";
import { useStoryStyles } from "./building-blocks";
import { PageScroll } from "./page-scroll";
import { ChangeToolDemo, ConnectedToolsDemo, WorkbenchOverviewDemo } from "./why-story-demos";

const REASONS = [
  {
    title: "All your vibe coded tools under one roof.",
    body: "Give the tools you build a home. Open them together in your own workbench.",
    Demo: WorkbenchOverviewDemo,
  },
  {
    title: "Connect the tools you build to fit your workflows.",
    body: "Use what one tool produces in the next. Here, research becomes a brief and a plan.",
    Demo: ConnectedToolsDemo,
  },
  {
    title: "Make it work your way.",
    body: "Start with something useful. Ask your agent for the changes you need.",
    Demo: ChangeToolDemo,
  },
];

export const WhyPromptStudioView = () => {
  const styles = useStoryStyles();
  return (
    <PageScroll>
      <Box css={styles.page}>
        {REASONS.map(({ title, body, Demo }, index) => (
          <Box as="section" css={styles.section} key={title}>
            <Stack css={styles.intro}>
              <Text textStyle="label/S/regular" color="fg.muted">
                0{index + 1} / {index === 0 ? "Your workbench" : "Your tools"}
              </Text>
              <Text as={index === 0 ? "h1" : "h2"} textStyle={{ base: "heading/M", md: "heading/L" }}>
                {title}
              </Text>
              <Text textStyle="paragraph/L/regular" color="fg.muted">
                {body}
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
