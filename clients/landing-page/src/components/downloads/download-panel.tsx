import { Box, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { OpenAiLogo } from "@phosphor-icons/react";
import { SquareTerminal } from "lucide-react";
import { SITE_LINKS } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { AnthropicLogo } from "../icons/anthropic-logo";
import { DashedTag } from "./dashed-tag";
import { DownloadPicker } from "./download-picker";

export const START_HERE_TITLE = "A workbench for your tools.";
export const START_HERE_INTRO =
  "Coding agents can build tools to help with your work. Prompt Studio gives them a place to live, with the shared infrastructure they need to work together.";

export const DownloadPanel = () => {
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
