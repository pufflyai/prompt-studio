import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { Disposable, ShellModeActivationContext } from "../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../react";
import { itemResource, mailWidgetIds, randomShellModes, type ShellModeItem } from "./random-shell-example-data";

const mailMode = randomShellModes.mail;

const findActiveThread = (input: ShellWidgetRenderInput) => {
  const placement = input.shell.layout.getLayout().areas.main.widgets[0];
  const itemId =
    typeof placement?.resource?.metadata?.itemId === "string" ? placement.resource.metadata.itemId : undefined;
  return (
    mailMode.items.find((item) => item.id === itemId) ??
    mailMode.items.find((item) => item.id === mailMode.defaultItemId) ??
    mailMode.items[0]
  );
};

const openThread = (input: ShellWidgetRenderInput, item: ShellModeItem) => {
  input.shell.layout.openWidget(mailWidgetIds.reader, {
    resource: itemResource(mailMode.id, item),
    title: item.title,
  });
  input.refresh();
};

const MailTopBar = (props: { input: ShellWidgetRenderInput }) => {
  const thread = findActiveThread(props.input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <ShellIcon name={mailMode.topIcon} size={18} />
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/S/medium" color="fg" truncate>
          {mailMode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {mailMode.topSubtitle} · {thread.title}
        </Text>
      </Stack>
      <Button size="xs" variant="ghost">
        <ShellIcon name="Search" size={14} />
        Search
      </Button>
      <Button size="xs" variant="subtle">
        <ShellIcon name="PenLine" size={14} />
        Compose
      </Button>
    </HStack>
  );
};

const MailThreads = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activeThread = findActiveThread(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "xs" }}>
      <Stack gap="sm" w="full">
        {mailMode.folders.map((folder) => (
          <Stack key={folder.id} gap="2xs">
            <HStack gap="xs" px="xs" justifyContent="space-between">
              <HStack gap="xs">
                <ShellIcon name={folder.icon} size={14} color="fg.muted" />
                <Text textStyle="label/XS/medium" color="fg.muted" truncate>
                  {folder.label}
                </Text>
              </HStack>
              <Badge size="xs" variant="subtle" colorPalette="gray">
                {folder.itemIds.length}
              </Badge>
            </HStack>
            <Stack gap="0">
              {folder.itemIds.map((itemId) => {
                const item = mailMode.items.find((candidate) => candidate.id === itemId);
                if (!item) return null;
                const selected = item.id === activeThread.id;
                return (
                  <Box
                    key={`${folder.id}.${item.id}`}
                    as="button"
                    onClick={() => openThread(input, item)}
                    textAlign="left"
                    borderRadius="sm"
                    bg={selected ? "bg.emphasized" : "transparent"}
                    _hover={{ bg: selected ? "bg.emphasized" : "bg.muted" }}
                    px="sm"
                    py="xs"
                    borderLeftWidth="2px"
                    borderLeftColor={selected ? "blue.fg" : "transparent"}
                    minW="0"
                  >
                    <Stack gap="0" minW="0">
                      <Text textStyle="paragraph/S/medium" color="fg" truncate>
                        {item.title}
                      </Text>
                      <Text textStyle="label/XS/regular" color="fg.muted" truncate>
                        {item.subtitle}
                      </Text>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
};

const MailReader = (props: { input: ShellWidgetRenderInput }) => {
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
          <Stack key={section.heading} gap="xs" borderLeftWidth="2px" borderColor="border.muted" pl="sm">
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
              <ShellIcon name={action.icon} size={14} />
              {action.label}
            </Button>
          ))}
        </HStack>
      </Stack>
    </ScrollArea>
  );
};

const MailParticipants = () => (
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
              <ShellIcon name={entry.icon} size={14} />
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

const MailStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <ShellIcon name={mailMode.statusIcon} size={12} color="fg.muted" />
    <Text textStyle="label/XS/medium" color="fg">
      {mailMode.statusText}
    </Text>
  </HStack>
);

interface WidgetSetup {
  id: string;
  title: string;
  area: "top" | "main-left" | "main" | "main-right" | "status";
  render: (input: ShellWidgetRenderInput) => React.ReactNode;
}

const mailWidgets: WidgetSetup[] = [
  { id: mailWidgetIds.top, title: "Mail header", area: "top", render: (input) => <MailTopBar input={input} /> },
  {
    id: mailWidgetIds.threads,
    title: "Thread list",
    area: "main-left",
    render: (input) => <MailThreads input={input} />,
  },
  { id: mailWidgetIds.reader, title: "Reading pane", area: "main", render: (input) => <MailReader input={input} /> },
  { id: mailWidgetIds.participants, title: "Participants", area: "main-right", render: () => <MailParticipants /> },
  { id: mailWidgetIds.status, title: "Inbox status", area: "status", render: () => <MailStatus /> },
];

export const setupMailMode = (ctx: ShellModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [];

  for (const widget of mailWidgets) {
    disposables.push(
      ctx.renderers.registerRenderer({ id: widget.id, render: widget.render }),
      ctx.layout.registerWidget({
        id: widget.id,
        title: widget.title,
        area: widget.area,
        singleton: true,
        renderer: "react",
        rendererId: widget.id,
      }),
    );
  }

  const defaultThread = mailMode.items.find((item) => item.id === mailMode.defaultItemId) ?? mailMode.items[0];
  ctx.layout.openWidget(mailWidgetIds.reader, {
    resource: itemResource(mailMode.id, defaultThread),
    title: defaultThread.title,
    closable: false,
  });
  for (const widget of mailWidgets) {
    if (widget.id === mailWidgetIds.reader) continue;
    ctx.layout.openWidget(widget.id, { pinned: true, closable: false });
  }

  return disposables;
};
