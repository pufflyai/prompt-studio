import { Box, Flex, Heading, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { ToolShape, type ToolShapeKind } from "../shapes/tool-shapes";
import { PageScroll } from "./page-scroll";

/** What Prompt Studio hands every tool. Ordered as the mission lists the core areas. */
const PROVIDED = [
  {
    name: "Sessions",
    detail:
      "The durable record of one agent run: the prompt, the live output, approvals, attachments, and how it ended. Still readable a month later.",
  },
  {
    name: "Workspaces",
    detail:
      "An isolated place for work to happen, backed by a git worktree by default, so several agents can run at once without standing on each other.",
  },
  {
    name: "Storage",
    detail:
      "Somewhere for your tool to keep its data, scoped to your extension, backed up and synced with everything else.",
  },
  {
    name: "Live sync",
    detail:
      "Every client and every agent sees the same state as it changes. You do not write subscriptions, polling, or reconciliation.",
  },
  {
    name: "Permissions",
    detail:
      "What a tool is allowed to touch, and the secrets it can never read. Enforced by the platform, so one careless extension cannot widen its own access.",
  },
];

/** What an extension contributes. One shape per surface, matching the illustration vocabulary. */
const SURFACES: { name: string; badge: string; kind: ToolShapeKind; detail: string }[] = [
  { name: "Commands", badge: "CLI", kind: "command", detail: "Add pst commands that people and agents can both run." },
  { name: "Pages", badge: "UI", kind: "page", detail: "Add project pages inside the workbench." },
  { name: "Editors", badge: "NATIVE", kind: "editor", detail: "Build native editors for project resources." },
  { name: "Skills", badge: "AGENT", kind: "skill", detail: "Package instructions an agent can install and follow." },
  { name: "Hooks", badge: "EVENTS", kind: "hook", detail: "React to project, workspace, and session events." },
  {
    name: "Automations",
    badge: "SCHEDULED",
    kind: "automation",
    detail: "Schedule extension work without leaving the project.",
  },
];

const SectionHeading = (props: { title: string; intro: string }) => (
  <Stack gap="12px" pt="22px" borderTopWidth="1px" borderColor="border.subtle">
    <Text fontFamily="heading" fontSize="22px" fontWeight="semibold" lineHeight="1.2" letterSpacing="-0.3px">
      {props.title}
    </Text>
    <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted" maxWidth="660px">
      {props.intro}
    </Text>
  </Stack>
);

export const FeaturesView = () => (
  <PageScroll>
    <Flex justify="center">
      <Stack width="100%" maxWidth="820px" gap="18px" px="32px" pt="38px" pb="44px">
        <Heading
          as="h1"
          fontFamily="heading"
          fontWeight="semibold"
          fontSize={{ base: "26px", md: "34px" }}
          lineHeight="1.15"
          maxWidth="660px"
        >
          What you get, and what you add.
        </Heading>
        <Text fontFamily="body" fontSize="15px" lineHeight="1.5" color="fg.muted" maxWidth="660px">
          Prompt Studio runs the parts every tool needs. Anything specific to your work is an extension, and an
          extension is a plain package built with @pstdio/sdk.
        </Text>

        <SectionHeading
          title="What Prompt Studio provides"
          intro="Handed to every tool, on its first line. None of it is yours to write, configure, or keep in sync."
        />
        <Stack gap="24px" pt="8px">
          {PROVIDED.map((service) => (
            <Stack key={service.name} gap="6px">
              <Text fontFamily="heading" fontSize="16px" fontWeight="semibold" letterSpacing="-0.2px">
                {service.name}
              </Text>
              <Text fontFamily="body" fontSize="13px" lineHeight="1.55" color="fg.muted" maxWidth="640px">
                {service.detail}
              </Text>
            </Stack>
          ))}
        </Stack>

        <SectionHeading
          title="Everything else is an extension"
          intro="The workbench has no fixed set of screens. Its tabs, pages, editors, commands and scheduled work are all contributed, including the ones Prompt Studio ships with. Your extensions use exactly the same interfaces as ours."
        />

        <SectionHeading
          title="What an extension can add"
          intro="Six surfaces. Ask for any of them in a sentence and your agent writes the extension that contributes it."
        />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="12px" pt="2px">
          {SURFACES.map((surface) => (
            <Stack
              key={surface.name}
              gap="12px"
              px="20px"
              py="18px"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.subtle"
              rounded="10px"
            >
              <HStack gap="12px" align="center">
                <Flex
                  width="44px"
                  height="44px"
                  flexShrink="0"
                  align="center"
                  justify="center"
                  bg="bg.muted"
                  rounded="8px"
                >
                  <ToolShape kind={surface.kind} size={20} />
                </Flex>
                <Text fontFamily="heading" fontSize="18px" fontWeight="semibold" letterSpacing="-0.2px">
                  {surface.name}
                </Text>
                <Box flex="1" />
                <Box px="7px" py="3px" borderWidth="1px" borderColor="border.subtle" rounded="4px">
                  <Text fontFamily="mono" fontSize="8px" color="fg.subtle" letterSpacing="0.7px">
                    {surface.badge}
                  </Text>
                </Box>
              </HStack>
              <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted">
                {surface.detail}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>
    </Flex>
  </PageScroll>
);
