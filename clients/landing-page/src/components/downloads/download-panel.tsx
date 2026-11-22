import { Badge, Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { OpenAiLogo } from "@phosphor-icons/react";
import { ArrowRight } from "lucide-react";
import { SITE_LINKS } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { CopilotLogo, OpenCodeLogo, PiLogo } from "../icons/agent-logos";
import { AnthropicLogo } from "../icons/anthropic-logo";
import { DashedTag } from "./dashed-tag";
import { DownloadPicker } from "./download-picker";

export const START_HERE_TITLE = "A workbench for your agents.";
export const START_HERE_INTRO =
  "Coding agents can build tools to help with your work. Prompt Studio gives these tools a place to live and work together.";

export const DownloadPanel = (props: { headingLevel: "h1" | "h2" }) => {
  const { headingLevel } = props;
  const styles = useLandingStyles();
  return (
    <Box css={styles.heroCopy} data-download-panel="">
      <HStack>
        <Badge css={styles.releaseBadge} size="lg">
          Alpha release
        </Badge>
      </HStack>
      <Text id="download-panel-title" as={headingLevel} textStyle={{ base: "heading/L", xl: "heading/XL" }}>
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
            icon={<OpenCodeLogo size={14} />}
            label="opencode"
            tone="opencode"
          />
          <DashedTag href={SITE_LINKS.harnessPi} icon={<PiLogo size={14} />} label="pi" tone="pi" />
          <DashedTag
            href={SITE_LINKS.harnessCopilot}
            icon={<CopilotLogo size={14} />}
            label="github copilot"
            tone="copilot"
          />
        </HStack>
      </Stack>
      <Button asChild variant="ghost" size="sm" alignSelf="start">
        <a href="/what-is-prompt-studio/">
          What is an agentic workbench?
          <ArrowRight />
        </a>
      </Button>
    </Box>
  );
};
