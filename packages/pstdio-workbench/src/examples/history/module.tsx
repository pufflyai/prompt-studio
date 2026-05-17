import { Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import type { HistoryEntry, WorkbenchCore, WorkbenchModuleContribution } from "../../core";
import { useWorkbenchStore } from "../../react";

const CLOSE_ACTIVE_WIDGET_COMMAND_ID = "workbench.closeActiveWidget";

const TICKET_KIND = "history.example.ticket";
const HOME_WIDGET_ID = "history.example.home";
const HOME_RENDERER_ID = "history.example.home-renderer";
const TICKET_WIDGET_ID = "history.example.ticket";
const TICKET_RENDERER_ID = "history.example.ticket-renderer";

interface HistoryHomeProps {
  workbench: WorkbenchCore;
}

const renderEntry = (entry: HistoryEntry) =>
  entry.kind === "resource" ? `resource:${entry.resource?.uri}` : `widget:${entry.widgetId}`;

const HistoryHome = (props: HistoryHomeProps) => {
  const { workbench } = props;
  const history = useWorkbenchStore(workbench.history.store, (state) => state);
  // Subscribe to layout so the close-button enabled state updates when
  // the active widget changes (isEnabled reads layout state).
  useWorkbenchStore(workbench.layout.store, (state) => state.layout.activeWidgetId);
  const canCloseActive = workbench.commands.isCommandEnabled(CLOSE_ACTIVE_WIDGET_COMMAND_ID);

  const open = (id: string) =>
    workbench.resources.openResource({
      kind: TICKET_KIND,
      uri: `${TICKET_KIND}:${id}`,
      id,
      label: `Ticket ${id}`,
    });

  return (
    <Stack p="lg" gap="md">
      <Text textStyle="title/S/semibold">Editor history demo</Text>
      <Text textStyle="paragraph/M/regular">
        Open tickets to grow history, then exercise <Code colorPalette="gray">workbench.history</Code> with the buttons
        below.
      </Text>
      <HStack gap="sm" wrap="wrap">
        {["PS-1", "PS-2", "PS-3", "PS-4"].map((id) => (
          <Button size="sm" key={id} onClick={() => open(id)}>
            Open {id}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          disabled={!canCloseActive}
          onClick={() => workbench.commands.executeCommand(CLOSE_ACTIVE_WIDGET_COMMAND_ID)}
        >
          Close active ticket
        </Button>
      </HStack>
      <HStack gap="sm" wrap="wrap">
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.action.navigateBack")}>
          Back
        </Button>
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.action.navigateForward")}>
          Forward
        </Button>
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.action.navigatePrevious")}>
          Previous
        </Button>
        <Button size="sm" onClick={() => workbench.commands.executeCommand("workbench.action.reopenLastClosed")}>
          Reopen last closed
        </Button>
        <Button size="sm" variant="ghost" onClick={() => workbench.history.clear()}>
          Clear
        </Button>
      </HStack>
      <Box>
        <Text textStyle="label/S/semibold">Entries (cursor: {history.cursor})</Text>
        <Stack gap="2xs" mt="2xs">
          {history.entries.map((entry, index) => (
            <Text key={entry.entryId} textStyle="label/XS/regular" color={index === history.cursor ? "fg" : "fg.muted"}>
              [{index}] {renderEntry(entry)}
            </Text>
          ))}
        </Stack>
      </Box>
      <Box>
        <Text textStyle="label/S/semibold">Recently closed</Text>
        <Stack gap="2xs" mt="2xs">
          {history.recentlyClosed.map((entry) => (
            <Text key={entry.entryId} textStyle="label/XS/regular" color="fg.muted">
              {renderEntry(entry)}
            </Text>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

const TicketPanel = (props: { title?: string; uri?: string }) => (
  <Stack p="lg" gap="sm">
    <Text textStyle="title/S/semibold">{props.title ?? "Ticket"}</Text>
    <Code colorPalette="gray">{props.uri}</Code>
  </Stack>
);

export const createHistoryExampleModule = (): WorkbenchModuleContribution => ({
  id: "history.example",
  activate(ctx) {
    ctx.resources.registerKind({ kind: TICKET_KIND, label: "Ticket" });
    ctx.resources.registerOpener({
      id: "history.example.ticket-opener",
      canOpen: (resource) => resource.kind === TICKET_KIND,
      open: (resource) => {
        ctx.layout.openWidget(TICKET_WIDGET_ID, { resource, title: resource.label ?? resource.uri });
      },
    });

    ctx.renderers.registerRenderer({
      id: HOME_RENDERER_ID,
      render: ({ workbench }) => <HistoryHome workbench={workbench} />,
    });

    ctx.renderers.registerRenderer({
      id: TICKET_RENDERER_ID,
      render: ({ placement }) => <TicketPanel title={placement.title} uri={placement.resource?.uri} />,
    });

    ctx.layout.registerWidget({
      id: HOME_WIDGET_ID,
      title: "History demo",
      area: "main-bottom",
      areaSize: { defaultPx: 320 },
      singleton: true,
      rendererId: HOME_RENDERER_ID,
    });

    ctx.layout.registerWidget({
      id: TICKET_WIDGET_ID,
      title: "Ticket",
      area: "main",
      closable: true,
      singleton: true,
      rendererId: TICKET_RENDERER_ID,
      resourceKinds: [TICKET_KIND],
    });

    ctx.layout.openWidget(HOME_WIDGET_ID);
    // The home widget is part of the demo chrome, not user-opened content;
    // drop it from history so goBack/goPrevious only walks user-opened tickets.
    ctx.history.clear();
  },
});
