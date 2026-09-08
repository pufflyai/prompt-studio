import { Box, Flex, Heading, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { ToolShape, type ToolShapeKind } from "../shapes/tool-shapes";
import { PageScroll } from "./page-scroll";

/** Features people use while building and running their tools. */
const PROVIDED = [
  {
    name: "Sessions",
    detail:
      "Follow your agent as it works. Read its output, answer questions, and return to the conversation when you need it.",
  },
  {
    name: "Workspaces",
    detail:
      "Work on several ideas at once. Give each agent its own copy of the project so changes stay separate until you are ready to bring them together.",
  },
  {
    name: "Storage",
    detail: "Keep the information your tools collect and create. Come back to it the next time you open the project.",
  },
  {
    name: "Live sync",
    detail: "See updates as they happen while you and your agents work on the same project.",
  },
  {
    name: "Notifications",
    detail: "Find out when a task finishes or an agent needs your input, without watching every conversation.",
  },
];

/** What an extension contributes. One shape per surface, matching the illustration vocabulary. */
const SURFACES: { name: string; badge: string; kind: ToolShapeKind; detail: string }[] = [
  {
    name: "Commands",
    badge: "CLI",
    kind: "command",
    detail: "Turn repeated work into a command you or your agent can run.",
  },
  {
    name: "Pages",
    badge: "UI",
    kind: "page",
    detail: "Build dashboards, trackers, and forms you can open beside your other tools.",
  },
  {
    name: "Editors",
    badge: "NATIVE",
    kind: "editor",
    detail: "View and edit project files in a way that fits their content.",
  },
  {
    name: "Skills",
    badge: "AGENT",
    kind: "skill",
    detail: "Teach your agent how you want a task done, then reuse those instructions.",
  },
  {
    name: "Hooks",
    badge: "EVENTS",
    kind: "hook",
    detail: "Run a tool when something changes in your project or an agent finishes work.",
  },
  {
    name: "Automations",
    badge: "SCHEDULED",
    kind: "automation",
    detail: "Schedule summaries, checks, and other tasks to run for you.",
  },
];

const SectionHeading = (props: { title: string; intro: string }) => (
  <Stack gap="12px" pt="22px" borderTopWidth="1px" borderColor="border.subtle">
    <Text fontFamily="heading" fontSize="22px" fontWeight="semibold" lineHeight="1.2" letterSpacing="-0.3px">
      {props.title}
    </Text>
    <Text fontFamily="body" fontSize="13px" lineHeight="1.5" color="fg.muted">
      {props.intro}
    </Text>
  </Stack>
);

export const FeaturesView = () => (
  <PageScroll>
    <Stack width="100%" gap="18px" px="32px" pt="38px" pb="44px">
      <Heading
        as="h1"
        fontFamily="heading"
        fontWeight="semibold"
        fontSize={{ base: "26px", md: "34px" }}
        lineHeight="1.15"
      >
        A workspace for the tools you build.
      </Heading>
      <Text fontFamily="body" fontSize="15px" lineHeight="1.5" color="fg.muted">
        Build custom tools with your agent, use them together, and keep improving them as your work changes.
      </Text>

      <SectionHeading
        title="Build with your agents"
        intro="Keep your conversations, project files, and running work together."
      />
      <Stack gap="24px" pt="8px">
        {PROVIDED.map((service) => (
          <Stack key={service.name} gap="6px">
            <Text fontFamily="heading" fontSize="16px" fontWeight="semibold" letterSpacing="-0.2px">
              {service.name}
            </Text>
            <Text fontFamily="body" fontSize="13px" lineHeight="1.55" color="fg.muted">
              {service.detail}
            </Text>
          </Stack>
        ))}
      </Stack>

      <SectionHeading
        title="Choose what belongs in your workspace"
        intro="Add the tools you need and remove the ones you do not. Tools are packaged as extensions, so you can install one, build your own, or change an existing one with your agent."
      />

      <SectionHeading
        title="What will you build?"
        intro="A dashboard for your data, an editor for your files, or a task that runs every morning. Describe what you want your tool to do."
      />
      <SimpleGrid minChildWidth="60" gap="12px" pt="2px">
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
  </PageScroll>
);
