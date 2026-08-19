import { Box } from "@chakra-ui/react";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "@pstdio/workbench";
import { Workbench } from "@pstdio/workbench/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerExtensionContributions } from "./extension-contribution-registration";

const PROJECT_ID = "demo-project";

const ticketsRecord = {
  id: "pstdio-core-tickets.tickets",
  extensionId: "pstdio.pstdio-core-tickets",
  title: "Tickets",
  resourceKind: "ticket",
  queryHandlerId: "pstdio-core-tickets.tickets.query",
  attributes: [
    {
      id: "status",
      label: "Status",
      type: {
        kind: "enum" as const,
        options: [
          { value: "todo", label: "Todo", color: "blue" },
          { value: "in-progress", label: "In progress", color: "yellow" },
          { value: "done", label: "Done", color: "green" },
        ],
      },
      filterable: true,
      groupable: true,
      sortable: true,
      displayable: true,
    },
    {
      id: "archived",
      label: "Archived",
      type: {
        kind: "enum" as const,
        options: [
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
        ],
      },
      filterable: true,
      editable: false,
    },
  ],
  defaultFilters: { archived: ["active"] },
  defaultSettings: { viewMode: "board" as const, columnGrouping: "status" },
  rowActions: [
    {
      id: "run-attempt",
      label: "Run attempt",
      icon: "play",
      commandId: "story.run-attempt",
    },
  ],
};

const sampleRows = [
  { id: "PS-10", title: "PS-10 Wire up dashboard board", attributes: { status: "todo", archived: "active" } },
  {
    id: "PS-11",
    title: "PS-11 Wire bridge webview",
    attributes: { status: "in-progress", archived: "active" },
  },
  { id: "PS-12", title: "PS-12 Ship", attributes: { status: "done", archived: "active" } },
  { id: "PS-9", title: "PS-9 Retired board experiment", attributes: { status: "done", archived: "archived" } },
];

const queryResponse: CommandExecuteResponse = {
  commandId: ticketsRecord.queryHandlerId,
  extensionId: ticketsRecord.extensionId,
  outcome: {
    ok: true,
    status: "success",
    value: { rows: sampleRows },
  },
};

const metadata: DashboardExtensionMetadata = {
  ...emptyDashboardExtensionMetadata,
  commands: [
    {
      id: "story.run-attempt",
      extensionId: ticketsRecord.extensionId,
      title: "Run attempt",
    },
  ],
  menuContributions: [
    {
      id: "story.run-attempt.ticket",
      extensionId: ticketsRecord.extensionId,
      commandId: "story.run-attempt",
      slotId: "ticket.headerOverflow",
      label: "Run attempt",
      icon: "play",
    },
  ],
  kanbanRenderers: [ticketsRecord],
  panels: [
    {
      id: "story.tickets",
      extensionId: ticketsRecord.extensionId,
      title: "Tickets",
      supportedRegions: ["main"],
      renderer: { kind: "kanban", id: ticketsRecord.id },
    },
  ],
};

// The story drives the shared dashboard registration path: this stub returns the
// fixed query result for the tickets board and a generic success for any other
// command (mutations etc.), so we never depend on the live extension transport.
const stubExecuteCommand = async (
  _projectId: string,
  commandId: string,
  _body: unknown,
): Promise<CommandExecuteResponse> => {
  if (commandId === ticketsRecord.queryHandlerId) return queryResponse;
  return {
    commandId,
    extensionId: ticketsRecord.extensionId,
    outcome: { ok: true, status: "success", value: undefined },
  };
};

const workbench = createWorkbenchCore();
workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });

workbench.registerModule({
  id: "story.extension-board",
  activate(ctx) {
    const disposables = registerExtensionContributions({
      ctx,
      executeCommand: stubExecuteCommand,
      metadata,
      projectId: PROJECT_ID,
    });

    ctx.layout.openPanel("story.tickets");
    return disposables;
  },
});

const meta = {
  title: "Extensions/KanbanRendererBoard",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj;

// Board is registered through `registerExtensionContributions`, the shared
// workbench kanban-renderer adapter path. The board, attributes, and rows all
// flow through the host adapter — no dashboard-side fork.
export const Default: Story = {
  render: () => (
    <Box h="100dvh" w="full">
      <Workbench workbench={workbench} />
    </Box>
  ),
};
