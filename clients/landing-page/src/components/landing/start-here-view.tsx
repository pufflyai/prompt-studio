import { Box, HStack, Icon, Stack, Text, useBreakpointValue } from "@chakra-ui/react";
import { OpenAiLogo } from "@phosphor-icons/react";
import { ResizableSplitLayout } from "@pstdio/ui";
import { SquareTerminal } from "lucide-react";
import { ShapeField } from "../shapes/shape-field";
import { AnthropicLogo } from "./anthropic-logo";
import { DashedTag } from "./dashed-tag";
import { DownloadPicker } from "./download-picker";
import { SITE_LINKS } from "./landing-content";
import { PageScroll } from "./page-scroll";
import { useLandingStyles } from "./use-landing-styles";

export const START_HERE_TITLE = "A place for your tools to live.";
export const START_HERE_INTRO =
  "Prompt Studio is a workbench where you and your agents can build and run tailored tools for your work.";

interface StartHereViewProps {
  windowOffset?: { x: number; y: number };
}

const HomeIntroduction = () => {
  const styles = useLandingStyles();
  return (
    <Box css={styles.heroCopy}>
      <Text as="h1" textStyle={{ base: "heading/L", xl: "heading/XL" }}>
        {START_HERE_TITLE}
      </Text>
      <Text textStyle="paragraph/XL/regular" color="fg.muted">
        {START_HERE_INTRO}
      </Text>
      <DownloadPicker />
      <Stack gap="sm" pt="md">
        <Text textStyle="label/S/regular" color="fg.muted">
          Works with your agents
        </Text>
        <HStack gap="xs" flexWrap="wrap">
          <DashedTag
            href={SITE_LINKS.harnessClaudeCode}
            icon={<AnthropicLogo size={14} />}
            label="claude code"
            tone="anthropic"
          />
          <DashedTag
            href={SITE_LINKS.harnessCodex}
            icon={<Icon as={OpenAiLogo} boxSize="icon-xs" />}
            label="codex"
            tone="openai"
            invertedOnHover
          />
          <DashedTag
            href={SITE_LINKS.harnessOpenCode}
            icon={<Icon as={SquareTerminal} boxSize="icon-xs" />}
            label="opencode"
            tone="opencode"
          />
        </HStack>
      </Stack>
    </Box>
  );
};

const ToolsContainer = (props: StartHereViewProps) => {
  const { windowOffset } = props;
  const styles = useLandingStyles();
  return (
    <Box css={styles.tools} role="region" aria-label="Your tools">
      <ShapeField spawn="container" worldOffset={windowOffset} />
    </Box>
  );
};

export const StartHereView = (props: StartHereViewProps) => {
  const { windowOffset } = props;
  const styles = useLandingStyles();
  const twoColumns = useBreakpointValue({ base: false, lg: true }) ?? false;
  if (!twoColumns) {
    return (
      <PageScroll>
        <Stack gap="panel-gap">
          <Box css={styles.hero}>
            <HomeIntroduction />
          </Box>
          <Box height="96" flexShrink={0}>
            <ToolsContainer windowOffset={windowOffset} />
          </Box>
        </Stack>
      </PageScroll>
    );
  }
  return (
    <ResizableSplitLayout
      width="full"
      height="full"
      resizableSide="left"
      defaultSizePx={480}
      minSizePx={360}
      contentMinSizePx={300}
      collapsible={false}
      resizeLabel="Resize download panel"
      resizablePanel={
        <Box css={styles.hero}>
          <PageScroll>
            <HomeIntroduction />
          </PageScroll>
        </Box>
      }
      contentPanel={<ToolsContainer windowOffset={windowOffset} />}
    />
  );
};
