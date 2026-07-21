import { Box, Flex, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { AppleLogo, LinuxLogo, OpenAiLogo } from "@phosphor-icons/react";
import { SquareTerminal } from "lucide-react";
import { AnthropicLogo } from "./anthropic-logo";
import { DashedTag } from "./dashed-tag";
import { INSTALL_COMMANDS, type LandingView, SITE_LINKS } from "./landing-content";
import { PromptToUiShowcase } from "./prompt-to-ui-showcase";
import { SectionRule } from "./section-rule";
import { TerminalBlock } from "./terminal-block";

const FOOTER_LINKS: { label: string; view: LandingView; href: string }[] = [
  { label: "Core concepts", view: "concepts", href: "/docs/concepts" },
  { label: "Explore extensions", view: "gallery", href: "/extensions" },
];

export const LANDING_DOCUMENT_TITLE = "A workbench that builds itself around your work.";

const CrossMark = () => (
  <Box position="relative" width="9px" height="9px" color="fg.subtle">
    <Box position="absolute" top="4px" left="0" width="9px" height="1px" bg="currentColor" />
    <Box position="absolute" top="0" left="4px" width="1px" height="9px" bg="currentColor" />
  </Box>
);

interface TagGroupProps {
  label: string;
  children: React.ReactNode;
  href?: string;
  onNavigate?: () => void;
}

const TagGroup = (props: TagGroupProps) => {
  const { label, children, href, onNavigate } = props;

  return (
    <Stack gap="8px">
      {href ? (
        <Link
          href={href}
          width="fit-content"
          fontFamily="mono"
          fontSize="10px"
          letterSpacing="1.6px"
          color="fg.subtle"
          _hover={{ color: "fg", textDecoration: "none" }}
          onClick={(event) => {
            if (!onNavigate) return;
            event.preventDefault();
            onNavigate();
          }}
        >
          {label} ↗
        </Link>
      ) : (
        <Text fontFamily="mono" fontSize="10px" letterSpacing="1.6px" color="fg.subtle">
          {label}
        </Text>
      )}
      <HStack gap="8px" flexWrap="wrap">
        {children}
      </HStack>
    </Stack>
  );
};

interface LandingDocumentProps {
  onNavigate: (view: LandingView) => void;
}

export const LandingDocument = (props: LandingDocumentProps) => {
  const { onNavigate } = props;

  return (
    <Stack
      width="100%"
      maxWidth="820px"
      gap="14px"
      pt="38px"
      pb="34px"
      px={{ base: "20px", md: "32px" }}
      position="relative"
    >
      <HStack justify="space-between">
        <CrossMark />
        <CrossMark />
      </HStack>

      <Text as="h1" textStyle="heading/display/M" maxWidth="496px">
        {LANDING_DOCUMENT_TITLE}
      </Text>
      <Text fontFamily="body" fontSize="15px" lineHeight="1.45" color="fg.muted" maxWidth="660px">
        The tools you wish existed are one prompt away: your agent builds it, and the workbench grows around how your
        team actually works.
      </Text>

      <Stack className="group" gap="12px" pt="10px">
        <SectionRule label="01 / install Prompt Studio" />
        <TerminalBlock commands={INSTALL_COMMANDS} />
      </Stack>

      <Stack gap="26px" pt="10px">
        <Stack className="group" gap="14px">
          <SectionRule label="02 / bring your own agent" />
          <Flex gap={{ base: "24px", md: "56px" }} flexWrap="wrap">
            <TagGroup label="harnesses" href="/extensions" onNavigate={() => onNavigate("gallery")}>
              <DashedTag
                icon={<AnthropicLogo size={12} />}
                label="claude code"
                href={SITE_LINKS.harnessClaudeCode}
                tone="anthropic"
              />
              <DashedTag
                icon={<OpenAiLogo size={12} />}
                label="codex"
                href={SITE_LINKS.harnessCodex}
                tone="openai"
                invertedOnHover
              />
              <DashedTag
                icon={<SquareTerminal size={12} />}
                label="opencode"
                href={SITE_LINKS.harnessOpenCode}
                tone="opencode"
              />
            </TagGroup>
            <TagGroup label="runs on">
              <DashedTag icon={<AppleLogo size={12} />} label="macos" />
              <DashedTag icon={<LinuxLogo size={12} />} label="linux" />
            </TagGroup>
          </Flex>
        </Stack>

        <Stack className="group" gap="14px">
          <SectionRule label="03 / the tool you need is one prompt away" />
          <PromptToUiShowcase />
        </Stack>
      </Stack>

      <HStack gap="18px" pt="8px" flexWrap="wrap">
        {FOOTER_LINKS.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            fontFamily="heading"
            fontWeight="medium"
            fontSize="11px"
            color="fg.muted"
            _hover={{ color: "fg" }}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(link.view);
            }}
          >
            {link.label} ↗
          </Link>
        ))}
      </HStack>
    </Stack>
  );
};
