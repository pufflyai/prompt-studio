import { Box, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { FittedDemo } from "../../hooks/use-fitted-demo";
import { usePurposeStyles } from "../../hooks/use-landing-styles";
import { ReadingListDemo } from "../examples/reading-list-demo";
import { PageScroll } from "../workbench/page-scroll";

export const WhatIsPromptStudioView = () => {
  const styles = usePurposeStyles();
  return (
    <FittedDemo>
      <Box layerStyle="panel" bg="bg" height="full" minWidth={0} overflow="hidden">
        <PageScroll pageKey="/what-is-prompt-studio/">
          <Box css={styles.page}>
            <Stack css={styles.intro}>
              <Text as="h1" textStyle={{ base: "heading/M", md: "heading/L" }}>
                What is Prompt Studio?
              </Text>
              <Text textStyle="paragraph/L/regular" color="fg.muted">
                A place for the tools your day is missing. Ask for one, use it, make it yours.
              </Text>
            </Stack>
            <ReadingListDemo />
            <HStack as="nav" aria-label="Explore Prompt Studio" css={styles.footer}>
              <Link href="/how-does-it-work/">How does it work?</Link>
              <Link href="/docs/guides/getting-started/add-tools/#ask-an-agent-to-build-your-tool">
                Build your first tool
              </Link>
              <Link href="/blog/welcome-to-prompt-studio/">Where it started</Link>
              <Link href="/blog/users-in-the-development-team/">The idea behind it</Link>
            </HStack>
          </Box>
        </PageScroll>
      </Box>
    </FittedDemo>
  );
};
