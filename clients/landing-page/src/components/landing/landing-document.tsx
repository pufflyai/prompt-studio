import { Box, Flex, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { AppleLogo, LinuxLogo, OpenAiLogo } from "@phosphor-icons/react";
import { RichMessage } from "@pstdio/ui/rich-text";
import { Blocks, Braces, SquareTerminal } from "lucide-react";
import { AnthropicLogo } from "./anthropic-logo";
import { DashedTag } from "./dashed-tag";
import type { DocPage } from "./doc-view";
import { INSTALL_COMMANDS, type LandingView, SITE_LINKS } from "./landing-content";
import { SectionRule } from "./section-rule";
import { TerminalBlock } from "./terminal-block";

const FOOTER_LINKS: { label: string; view: LandingView; href: string }[] = [
  { label: "Core concepts", view: "concepts", href: "/docs/concepts" },
  { label: "Real extensions", view: "gallery", href: "/extensions" },
  { label: "Working examples", view: "guide-getting-started", href: "/guides/getting-started" },
];

export const LANDING_DOCUMENT_TITLE = "A place for your tools to live.";
export const LANDING_DOCUMENT_INTRO =
  "Prompt Studio is a workbench that builds itself around your work. Ask your agent for the tools you need and the workbench grows around how your team actually works.";

export const LANDING_DOCUMENT_PAGE: DocPage = {
  title: LANDING_DOCUMENT_TITLE,
  intro: LANDING_DOCUMENT_INTRO,
  blocks: [
    { type: "heading", text: "Get Prompt Studio" },
    { type: "code", code: INSTALL_COMMANDS.join("\n"), language: "bash" },
    { type: "heading", text: "Bring your own agent" },
    {
      type: "paragraph",
      text: "Connect Claude Code, Codex, or OpenCode through harness extensions and use the agent you already trust.",
    },
    { type: "heading", text: "Build the tools you need" },
    {
      type: "paragraph",
      text: "Describe the project-local command, panel, editor, automation, template, or skill you need and let your agent assemble it inside the workbench.",
    },
  ],
};

const CrossMark = () => (
  <Box position="relative" width="9px" height="9px" color="fg.subtle">
    <Box position="absolute" top="4px" left="0" width="9px" height="1px" bg="currentColor" />
    <Box position="absolute" top="0" left="4px" width="1px" height="9px" bg="currentColor" />
  </Box>
);

const MOBILE_EXPLORE_LINKS = [
  {
    label: "CLI quickstart",
    description: "Install, initialize, and run your first agent.",
    icon: SquareTerminal,
    view: "guide-getting-started" as const,
  },
  {
    label: "SDK reference",
    description: "Build integrations with the Prompt Studio SDK.",
    icon: Braces,
    view: "sdk-reference" as const,
  },
  {
    label: "Extension gallery",
    description: "Add focused tools to the workbench.",
    icon: Blocks,
    view: "gallery" as const,
  },
];

const MobileLandingDocument = (props: LandingDocumentProps) => {
  const { onNavigate } = props;

  return (
    <Stack width="100%" gap="0" px="16px" pt="20px" pb="92px">
      <Text fontFamily="mono" fontSize="9px" fontWeight="semibold" letterSpacing="1.1px" color="fg.info">
        START HERE
      </Text>
      <Text as="h1" fontFamily="heading" fontSize="26px" fontWeight="semibold" lineHeight="1.12" mt="8px">
        Build the workbench your agents need.
      </Text>
      <Text fontFamily="body" fontSize="13px" lineHeight="1.55" color="fg.muted" mt="10px">
        Mix docs, editors, agents, and custom tools in one project. Prompt Studio keeps every workspace in place.
      </Text>
      <Text fontFamily="mono" fontSize="9px" letterSpacing="1.1px" color="fg.subtle" mt="18px">
        EXPLORE
      </Text>
      <Stack gap="7px" mt="16px">
        {MOBILE_EXPLORE_LINKS.map((link) => (
          <HStack
            key={link.label}
            as="button"
            width="100%"
            minHeight="77px"
            gap="12px"
            px="14px"
            py="12px"
            textAlign="left"
            bg="bg.subtle"
            borderWidth="1px"
            borderColor="border"
            rounded="8px"
            _hover={{ bg: "bg.hover" }}
            onClick={() => onNavigate(link.view)}
          >
            <Flex width="36px" height="36px" flexShrink="0" align="center" justify="center" bg="bg.hover" rounded="6px">
              <link.icon size={16} />
            </Flex>
            <Stack gap="2px">
              <Text fontFamily="heading" fontSize="15px" fontWeight="medium">
                {link.label}
              </Text>
              <Text fontFamily="body" fontSize="12px" lineHeight="1.4" color="fg.muted">
                {link.description}
              </Text>
            </Stack>
          </HStack>
        ))}
      </Stack>
    </Stack>
  );
};

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

const EXTENSION_EXAMPLE = `\`\`\`typescript
defineExtension({
  commands: {
    "preview.deploy": {
      agent: true,
      run: () => deploy("preview"),
    },
  },
});
\`\`\``;

const DesktopPromptExample = () => (
  <Flex gap="34px">
    <Text width="288px" flexShrink="0" fontFamily="heading" fontSize="15px" fontWeight="semibold" lineHeight="1.45">
      Describe the missing tool. Your agent builds it into the workbench.
    </Text>
    <Box flex="1" minWidth="0" height="168px" overflow="hidden">
      <RichMessage defaultState={EXTENSION_EXAMPLE} fullWidth />
    </Box>
  </Flex>
);

interface LandingDocumentProps {
  onNavigate: (view: LandingView) => void;
}

export const LandingDocument = (props: LandingDocumentProps) => {
  const { onNavigate } = props;

  return (
    <>
      <Box display={{ base: "block", md: "none" }} width="100%">
        <MobileLandingDocument onNavigate={onNavigate} />
      </Box>
      <Stack
        width="100%"
        maxWidth="820px"
        gap="14px"
        pt="38px"
        pb="34px"
        px="32px"
        position="relative"
        display={{ base: "none", md: "flex" }}
      >
        <HStack justify="space-between">
          <CrossMark />
          <CrossMark />
        </HStack>

        <Text as="h1" fontFamily="heading" fontSize="34px" fontWeight="semibold" lineHeight="1.15" maxWidth="560px">
          {LANDING_DOCUMENT_TITLE}
        </Text>
        <Text fontFamily="body" fontSize="15px" lineHeight="1.45" color="fg.muted" maxWidth="680px">
          {LANDING_DOCUMENT_INTRO}
        </Text>

        <Stack className="group" gap="12px" pt="14px">
          <SectionRule label="01 / get Prompt Studio" />
          <TerminalBlock commands={INSTALL_COMMANDS} />
        </Stack>

        <Stack gap="34px" pt="8px">
          <Stack className="group" gap="14px">
            <SectionRule label="02 / bring your own agent" />
            <Flex gap="56px" flexWrap="wrap">
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
            <SectionRule label="03 / build the tools you need" />
            <DesktopPromptExample />
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
    </>
  );
};
