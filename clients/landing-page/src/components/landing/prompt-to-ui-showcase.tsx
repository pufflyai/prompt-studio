import { Box, Button, Flex, HStack, IconButton, Menu, Portal, Spacer, Stack, Text } from "@chakra-ui/react";
import { OpenAiLogo } from "@phosphor-icons/react";
import { Header, ListRow, Tooltip } from "@pstdio/ui";
import { SendButton } from "@pstdio/ui/chat-ui";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  FileCode2,
  GitBranch,
  GitPullRequest,
  ListChecks,
  type LucideIcon,
  MessageSquareText,
  PanelBottom,
  PanelRight,
  Rocket,
  ShieldCheck,
  SquareTerminal,
  Tags,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AnthropicLogo } from "./anthropic-logo";
import { SHOWCASE_EXAMPLES, type ShowcaseExample, type ShowcaseTrayIcon } from "./prompt-to-ui-previews";

const HARNESS_OPTIONS = [
  { id: "codex", label: "Codex", icon: <OpenAiLogo size={14} /> },
  { id: "claude-code", label: "Claude Code", icon: <AnthropicLogo size={14} /> },
  { id: "opencode", label: "OpenCode", icon: <SquareTerminal size={14} /> },
];

const TRAY_ICONS: Record<ShowcaseTrayIcon, LucideIcon> = {
  "git-branch": GitBranch,
  "git-pull-request": GitPullRequest,
  "list-checks": ListChecks,
  messages: MessageSquareText,
  rocket: Rocket,
  "shield-check": ShieldCheck,
  tags: Tags,
  terminal: SquareTerminal,
  users: Users,
};

interface HarnessSelectorProps {
  selectedHarness: string;
  onSelectHarness: (harness: string) => void;
}

const HarnessSelector = (props: HarnessSelectorProps) => {
  const { selectedHarness, onSelectHarness } = props;
  const selected = HARNESS_OPTIONS.find((option) => option.id === selectedHarness) ?? HARNESS_OPTIONS[0];

  return (
    <Menu.Root lazyMount closeOnSelect positioning={{ placement: "bottom-start" }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" px="2" aria-label="Select harness">
          {selected.icon}
          <Text textStyle="label/XS/medium">{selected.label}</Text>
          <ChevronDown size={13} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="11rem">
            {HARNESS_OPTIONS.map((option) => (
              <Menu.Item key={option.id} value={option.id} asChild>
                <ListRow
                  variant="full-width"
                  icon={option.icon}
                  label={option.label}
                  isSelected={option.id === selectedHarness}
                  onClick={() => onSelectHarness(option.id)}
                />
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

interface PromptCardProps extends HarnessSelectorProps {
  prompt: string;
}

const PromptCard = (props: PromptCardProps) => {
  const { prompt, selectedHarness, onSelectHarness } = props;

  return (
    <Stack
      width={{ base: "100%", md: "220px" }}
      height={{ base: "132px", md: "226px" }}
      flexShrink="0"
      gap="0"
      p="xs"
      bg="bg"
      borderWidth="1px"
      borderStyle="solid"
      borderColor="border"
      borderRadius="xs"
      transition="border-color 0.2s ease-in-out"
      _hover={{ borderColor: "border.accent-light" }}
    >
      <Text textStyle="label/M/regular" lineHeight="1.5" color="fg">
        {prompt}
      </Text>
      <HStack gap="1" mt="auto" pt="md">
        <HarnessSelector selectedHarness={selectedHarness} onSelectHarness={onSelectHarness} />
        <Spacer />
        <SendButton
          canInterrupt={false}
          aria-label="Send example prompt"
          variant="outline"
          tabIndex={-1}
          pointerEvents="none"
          flexShrink="0"
        />
      </HStack>
    </Stack>
  );
};

const ExampleTray = (props: { example: ShowcaseExample }) => {
  const { example } = props;

  return (
    <Stack
      as="nav"
      aria-label={`${example.label} tools`}
      data-tray={example.id}
      width="32px"
      flexShrink="0"
      align="center"
      gap="4px"
      py="6px"
      bg="bg.subtle"
      borderRightWidth="1px"
      borderColor="border"
    >
      {example.tray.map((item, index) => {
        const TrayIcon = TRAY_ICONS[item.icon];
        return (
          <Tooltip key={item.label} content={item.label}>
            <Flex
              aria-label={item.label}
              width="24px"
              height="24px"
              align="center"
              justify="center"
              color={index === 0 ? "fg" : "fg.muted"}
              bg={index === 0 ? "bg.active" : undefined}
              borderRadius="xs"
            >
              <TrayIcon size={13} />
            </Flex>
          </Tooltip>
        );
      })}
    </Stack>
  );
};

const EditorPreview = (props: { example: ShowcaseExample; assembled: boolean }) => {
  const { example, assembled } = props;
  const Preview = example.preview;

  return (
    <Box
      flex="1"
      height="226px"
      minWidth="0"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      rounded="7px"
      overflow="hidden"
      aria-live="polite"
      data-example={example.id}
      data-assembled={assembled}
    >
      <Header variant="main" px="6px" gap="4px" bg="bg.subtle" borderBottomWidth="1px" borderColor="border">
        <HStack
          height="1.25rem"
          minWidth="0"
          maxWidth="12rem"
          px="xs"
          gap="2xs"
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="2xs"
        >
          <FileCode2 size={12} />
          <Text minWidth="0" textStyle="label/XS/medium" truncate>
            {example.label}
          </Text>
        </HStack>
        <Spacer />
        <IconButton aria-label="Show terminal panel" variant="ghost" size="2xs" tabIndex={-1} pointerEvents="none">
          <PanelBottom size={13} />
        </IconButton>
        <IconButton aria-label="Show right menu" variant="ghost" size="2xs" tabIndex={-1} pointerEvents="none">
          <PanelRight size={13} />
        </IconButton>
      </Header>
      <Flex height="calc(100% - 32px)">
        <ExampleTray example={example} />
        <Box flex="1" minWidth="0" p="12px" overflow="hidden">
          <Preview assembled={assembled} />
        </Box>
      </Flex>
    </Box>
  );
};

interface AnimatedExampleProps extends HarnessSelectorProps {
  example: ShowcaseExample;
  reducedMotion: boolean;
}

const AnimatedExample = (props: AnimatedExampleProps) => {
  const { example, reducedMotion, selectedHarness, onSelectHarness } = props;
  const [assembled, setAssembled] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setAssembled(true);
      return;
    }

    setAssembled(false);
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setAssembled(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [reducedMotion]);

  return (
    <Flex align="stretch" gap="9px" direction={{ base: "column", md: "row" }}>
      <PromptCard prompt={example.prompt} selectedHarness={selectedHarness} onSelectHarness={onSelectHarness} />
      <Flex align="center" justify="center" color="fg.subtle" flexShrink="0">
        <Box display={{ base: "none", md: "flex" }}>
          <ArrowRight size={15} />
        </Box>
        <Box display={{ base: "flex", md: "none" }}>
          <ArrowDown size={15} />
        </Box>
      </Flex>
      <EditorPreview example={example} assembled={assembled} />
    </Flex>
  );
};

export const PromptToUiShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedHarness, setSelectedHarness] = useState("codex");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const activeExample = SHOWCASE_EXAMPLES[activeIndex];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const nextIndex = (activeIndex + 1) % SHOWCASE_EXAMPLES.length;
    const timer = window.setTimeout(() => setActiveIndex(nextIndex), 6500);
    return () => window.clearTimeout(timer);
  }, [activeIndex, paused, reducedMotion]);

  return (
    <Stack
      gap="10px"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <HStack gap="4px" flexWrap="wrap" aria-label="Example prompts">
        {SHOWCASE_EXAMPLES.map((example, index) => (
          <Button
            key={example.id}
            size="xs"
            variant={index === activeIndex ? "subtle" : "ghost"}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            {example.label}
          </Button>
        ))}
      </HStack>
      <AnimatedExample
        key={activeExample.id}
        example={activeExample}
        reducedMotion={reducedMotion}
        selectedHarness={selectedHarness}
        onSelectHarness={setSelectedHarness}
      />
    </Stack>
  );
};
