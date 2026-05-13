import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { Disposable, ShellModeActivationContext, TreeNode } from "../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../react";
import { itemResource, mailWidgetIds, randomResourceKind, randomShellModes } from "./random-shell-example-data";

const mailMode = randomShellModes.mail;
const mailTreeViewId = "mail.navigation";

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

const buildMailTreeSections = () =>
  mailMode.folders.map((folder) => ({
    id: folder.id,
    label: folder.label,
    nodes: folder.itemIds.flatMap((itemId): TreeNode[] => {
      const item = mailMode.items.find((candidate) => candidate.id === itemId);
      if (!item) return [];
      const resource = itemResource(mailMode.id, item);
      return [
        {
          id: `${folder.id}.${resource.uri}`,
          label: item.title,
          icon: "Mail",
          description: item.subtitle,
          resource,
        },
      ];
    }),
  }));

const MailTopBar = (props: { input: ShellWidgetRenderInput }) => {
  const thread = findActiveThread(props.input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <ShellIcon name={mailMode.topIcon} size={18} />
      <HStack flex="1" minW="0" gap="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {mailMode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {mailMode.topSubtitle} · {thread.title}
        </Text>
      </HStack>
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
  area: "top" | "main" | "main-right" | "status";
  render: (input: ShellWidgetRenderInput) => React.ReactNode;
}

const mailWidgets: WidgetSetup[] = [
  { id: mailWidgetIds.top, title: "Mail header", area: "top", render: (input) => <MailTopBar input={input} /> },
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

  disposables.push(
    ctx.trees.registerTreeView({
      id: mailTreeViewId,
      title: mailMode.label,
      area: "main-left",
      getRoots: () => [],
      getSections: () => buildMailTreeSections(),
      getChildren: () => [],
    }),
    ctx.resources.registerOpener({
      id: "mail.opener",
      canOpen: (resource) => resource.kind === randomResourceKind && resource.metadata?.modeId === mailMode.id,
      open: (resource, input) =>
        ctx.layout.openWidget(mailWidgetIds.reader, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  );

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
