import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { randomWorkbenchModes } from "../mock-data/data";

const mailMode = randomWorkbenchModes.mail;

const findActiveThread = (input: WorkbenchWidgetRenderInput) => {
  const placement = input.workbench.layout.getLayout().areas.main.widgets[0];
  const itemId =
    typeof placement?.resource?.metadata?.itemId === "string" ? placement.resource.metadata.itemId : undefined;
  return (
    mailMode.items.find((item) => item.id === itemId) ??
    mailMode.items.find((item) => item.id === mailMode.defaultItemId) ??
    mailMode.items[0]
  );
};

export const MailTopBar = (props: { input: WorkbenchWidgetRenderInput }) => {
  const thread = findActiveThread(props.input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <WorkbenchIcon name={mailMode.topIcon} size={18} />
      <HStack flex="1" minW="0" gap="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {mailMode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {mailMode.topSubtitle} · {thread.title}
        </Text>
      </HStack>
      <Button size="xs" variant="ghost">
        <WorkbenchIcon name="Search" size={14} />
        Search
      </Button>
      <Button size="xs" variant="subtle">
        <WorkbenchIcon name="PenLine" size={14} />
        Compose
      </Button>
    </HStack>
  );
};

export const MailReader = (props: { input: WorkbenchWidgetRenderInput }) => {
  const thread = findActiveThread(props.input);
  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Stack gap="2xs">
          <Text textStyle="heading/M" color="fg">
            {thread.title}
          </Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            {thread.subtitle}
          </Text>
        </Stack>
        {thread.sections.map((section) => (
          <Stack key={section.heading} gap="xs" borderLeftWidth="2px" borderColor="border.subtle" pl="sm">
            <Text textStyle="label/XS/medium" color="fg.muted">
              {section.heading}
            </Text>
            <Stack gap="2xs">
              {section.lines.map((line) => (
                <Text key={line} textStyle="paragraph/S/regular" color="fg">
                  {line}
                </Text>
              ))}
            </Stack>
          </Stack>
        ))}
        <HStack gap="xs" pt="sm">
          {mailMode.actions.map((action) => (
            <Button key={action.id} size="xs" variant="subtle">
              <WorkbenchIcon name={action.icon} size={14} />
              {action.label}
            </Button>
          ))}
        </HStack>
      </Stack>
    </ScrollArea>
  );
};

export const MailParticipants = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      <Text textStyle="label/S/medium" color="fg">
        {mailMode.relatedTitle}
      </Text>
      <Stack gap="xs">
        {mailMode.related.map((entry) => (
          <HStack key={entry.label} gap="sm" minW="0">
            <Box
              boxSize="2rem"
              borderRadius="full"
              bg="blue.subtle"
              color="blue.fg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <WorkbenchIcon name={entry.icon} size={14} />
            </Box>
            <Stack gap="0" flex="1" minW="0">
              <Text textStyle="paragraph/S/medium" color="fg" truncate>
                {entry.label}
              </Text>
              <Text textStyle="label/XS/regular" color="fg.muted" truncate>
                {entry.hint}
              </Text>
            </Stack>
          </HStack>
        ))}
      </Stack>
    </Stack>
  </ScrollArea>
);

export const MailStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <WorkbenchIcon name={mailMode.statusIcon} size={12} color="fg.muted" />
    <Text textStyle="label/XS/medium" color="fg">
      {mailMode.statusText}
    </Text>
  </HStack>
);
