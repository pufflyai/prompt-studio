import { Box, Circle, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Check, Info, SquareTerminal, Zap } from "lucide-react";

const DESKTOP_STEPS = [
  { number: 1, title: "Install the CLI", description: "Add the latest pstdio binary.", state: "complete" },
  { number: 2, title: "Start Prompt Studio", description: "Launch the API and desktop workbench.", state: "active" },
  {
    number: 3,
    title: "Create a project",
    description: "Link the repository you want agents to use.",
    state: "pending",
  },
  { number: 4, title: "Choose an agent", description: "Connect Codex, Claude Code, or OpenCode.", state: "pending" },
] as const;

const TERMINAL_LINES = [
  { prompt: "$", command: "bun add -g pstdio@latest", output: "installed pstdio 0.24.0", tone: "fg.success" },
  { prompt: "$", command: "pstdio", output: "starting API on :19840\nopening workbench on :5555", tone: "fg.success" },
  {
    prompt: "$",
    command: "pstdio projects create",
    output: "Project name: Agentic Studio\nRepository: ~/Projects/agentic-studio",
    tone: "fg.info",
  },
  { prompt: "$", command: "pstdio agents setup codex", output: "waiting for project…", tone: "fg.success" },
] as const;

const DesktopQuickstart = () => (
  <Flex height="100%" display={{ base: "none", md: "flex" }}>
    <Stack width="460px" flexShrink="0" gap="0" px="42px" py="38px" bg="bg" borderRightWidth="1px" borderColor="border">
      <HStack gap="7px" color="fg.info">
        <Zap size={14} />
        <Text fontFamily="mono" fontSize="10px" fontWeight="semibold" letterSpacing="1.1px">
          CLI QUICKSTART
        </Text>
      </HStack>
      <Text as="h1" fontFamily="heading" fontSize="30px" fontWeight="semibold" lineHeight="1.15" mt="20px">
        From install to first agent in five minutes.
      </Text>
      <Text fontFamily="body" fontSize="14px" lineHeight="1.5" color="fg.muted" mt="24px">
        Follow the live terminal as Prompt Studio creates a project, connects your repository, and opens the workbench.
      </Text>
      <Stack gap="8px" mt="28px">
        {DESKTOP_STEPS.map((step) => (
          <HStack
            key={step.number}
            minHeight="63px"
            gap="13px"
            px="11px"
            borderWidth={step.state === "active" ? "1px" : "0"}
            borderColor="border.accent"
            bg={step.state === "active" ? "bg.hover" : "transparent"}
            rounded="6px"
          >
            <Circle
              size="27px"
              flexShrink="0"
              bg={step.state === "complete" ? "bg.success" : step.state === "active" ? "bg.info" : "bg.hover"}
              borderWidth="1px"
              borderColor={step.state === "complete" ? "border.success" : "border"}
              color={step.state === "complete" ? "fg.success" : step.state === "active" ? "fg.info" : "fg.muted"}
            >
              {step.state === "complete" ? <Check size={14} /> : <Text fontSize="11px">{step.number}</Text>}
            </Circle>
            <Stack gap="1px">
              <Text fontFamily="heading" fontSize="13px" fontWeight="semibold">
                {step.title}
              </Text>
              <Text fontFamily="body" fontSize="11px" color="fg.muted">
                {step.description}
              </Text>
            </Stack>
          </HStack>
        ))}
      </Stack>
      <HStack mt="auto" gap="8px" color="fg.muted">
        <Info size={13} />
        <Text fontFamily="body" fontSize="11px">
          Need help? Open the full CLI guide →
        </Text>
      </HStack>
    </Stack>
    <Stack flex="1" minWidth="0" gap="0" bg="bg.subtle">
      <HStack height="40px" flexShrink="0" px="16px" gap="8px" borderBottomWidth="1px" borderColor="border">
        <SquareTerminal size={13} />
        <Text fontFamily="heading" fontSize="12px" fontWeight="medium">
          Quickstart · zsh
        </Text>
      </HStack>
      <Stack gap="20px" px="34px" py="28px" fontFamily="mono" fontSize="12px">
        {TERMINAL_LINES.map((line, index) => (
          <Stack key={line.command} gap="6px" opacity={index === TERMINAL_LINES.length - 1 ? 0.35 : 1}>
            <HStack gap="11px">
              <Text color={line.tone} fontWeight="bold">
                {line.prompt}
              </Text>
              <Text>{line.command}</Text>
            </HStack>
            <Text whiteSpace="pre-line" color="fg.muted" fontSize="11px" pl="18px" lineHeight="1.55">
              {line.output}
            </Text>
          </Stack>
        ))}
      </Stack>
    </Stack>
  </Flex>
);

const MobileQuickstart = () => (
  <Stack display={{ base: "flex", md: "none" }} gap="0" px="16px" pt="20px" pb="92px">
    <Text fontFamily="mono" fontSize="9px" fontWeight="semibold" letterSpacing="1.1px" color="fg.info">
      QUICKSTART
    </Text>
    <Text as="h1" fontFamily="heading" fontSize="26px" fontWeight="semibold" lineHeight="1.12" mt="8px">
      From install to first agent in five minutes.
    </Text>
    <Text fontFamily="body" fontSize="13px" lineHeight="1.45" color="fg.muted" mt="10px">
      Follow one focused step at a time. Your progress stays visible while the active task takes the screen.
    </Text>
    <Stack gap="11px" px="13px" py="14px" mt="16px" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="8px">
      <HStack justify="space-between">
        <Text fontFamily="mono" fontSize="9px" fontWeight="semibold" letterSpacing="0.8px" color="fg.info">
          STEP 2 OF 4
        </Text>
        <Text fontFamily="body" fontSize="13px">
          Configure your project
        </Text>
      </HStack>
      <Box height="4px" bg="bg.hover" rounded="full" overflow="hidden">
        <Box width="50%" height="100%" bg="fg.info" rounded="full" />
      </Box>
    </Stack>
    <Stack gap="0" px="13px" py="13px" mt="17px" bg="bg.subtle" borderWidth="1px" borderColor="border" rounded="8px">
      <HStack justify="space-between">
        <Text fontFamily="heading" fontSize="15px" fontWeight="semibold">
          Configure the CLI
        </Text>
        <Box px="8px" py="2px" bg="bg.info" rounded="full">
          <Text fontFamily="mono" fontSize="8px" color="fg.info">
            CURRENT
          </Text>
        </Box>
      </HStack>
      <Text fontFamily="body" fontSize="12px" color="fg.muted" mt="10px">
        Add your project name and preferred agent provider.
      </Text>
      <Stack gap="8px" mt="12px" p="13px" bg="bg" rounded="7px">
        <Text fontFamily="mono" fontSize="10px" color="purple.300">
          pstdio.json
        </Text>
        <Text fontFamily="mono" fontSize="11px" lineHeight="1.55" whiteSpace="pre">
          {'{\n  "name": "prompt-studio",\n  "agent": "codex"\n}'}
        </Text>
      </Stack>
    </Stack>
  </Stack>
);

export const QuickstartView = () => (
  <Box height="100%">
    <DesktopQuickstart />
    <MobileQuickstart />
  </Box>
);
