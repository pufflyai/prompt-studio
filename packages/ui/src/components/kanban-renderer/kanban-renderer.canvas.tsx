import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { Plus } from "lucide-react";
import { KanbanRenderer } from "./kanban-renderer";
import { initialRows } from "./kanban-renderer-story-fixtures";
import { CreateFormWrapper, Wrapper } from "./kanban-renderer-story-wrappers";
import type { KanbanRendererSavedView, ViewMode } from "./types";

const meta: CanvasMeta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/Kanban Renderer",
  component: KanbanRenderer,
  fullscreen: true,
};
export default meta;
type Story = CanvasVariant;
const CHROME_UUID = "550e8400-e29b-41d4-a716-446655440000";
const chromeRows = initialRows.map((row, index) => {
  if (index === 0) return { ...row, id: CHROME_UUID, attributes: { ...row.attributes, id: "PS-1" } };
  if (index === 1) return { ...row, title: "PRA-1_A1", attributes: { ...row.attributes, id: "PRA-1_A1" } };
  return row;
});
export const BoardView: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--board-view",
  render: () => <Wrapper />,
};
export const RendererChromeAndTicketMenu: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--renderer-chrome-and-ticket-menu",
  render: () => (
    <Wrapper storageKey="preview-kanban-renderer-chrome" displayProperties={["id"]} withTicketMenu rows={chromeRows} />
  ),
};
export const ListView: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--list-view",
  render: () => <Wrapper storageKey="preview-kanban-renderer-list-view" viewMode="list" />,
};
const viewSettings = (viewMode: ViewMode, displayProperties: string[] = []) => ({
  viewMode,
  columnGrouping: "status",
  rowGrouping: "none",
  displayProperties,
});
const anyOf = (attributeId: string, values: string[]) => ({
  conjunction: "and" as const,
  rules: [{ attributeId, condition: "is-any-of" as const, value: values }],
});
const SAVED_VIEWS: KanbanRendererSavedView[] = [
  {
    id: "all",
    title: "All",
    settings: viewSettings("board", ["priority"]),
    filter: { conjunction: "and", rules: [] },
    sorts: [],
  },
  {
    id: "my-work",
    title: "My work",
    settings: viewSettings("list", ["assignee", "priority"]),
    filter: anyOf("assignee", ["Alex"]),
    sorts: [{ attributeId: "priority", direction: "asc" }],
  },
  {
    id: "design",
    title: "Design board",
    settings: viewSettings("board", ["component", "priority"]),
    filter: anyOf("component", ["frontend"]),
    sorts: [],
  },
  {
    id: "high-priority",
    title: "High priority",
    settings: viewSettings("board", ["assignee", "priority"]),
    filter: anyOf("priority", ["high"]),
    sorts: [{ attributeId: "updated", direction: "desc" }],
  },
];
export const SavedViews: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--saved-views",
  render: () => (
    <Wrapper storageKey="preview-kanban-renderer-saved-views" defaultViews={SAVED_VIEWS} defaultActiveViewId="all" />
  ),
};
export const SavedFilteredView: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--saved-filtered-view",
  render: () => (
    <Wrapper
      storageKey="preview-kanban-renderer-saved-filtered-view"
      defaultViews={SAVED_VIEWS}
      defaultActiveViewId="my-work"
    />
  ),
};
export const RendererOwnedCreateForm: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--renderer-owned-create-form",
  render: () => <CreateFormWrapper />,
};
export const EmptyState: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--empty-state",
  render: () => <Wrapper showEmptyState />,
};
export const CustomEmptyState: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--custom-empty-state",
  render: () => (
    <Wrapper
      showEmptyState
      emptyState={
        <Stack height="100%" align="center" justify="center" gap="md" borderWidth="1px" borderRadius="md">
          <Stack gap="xs" textAlign="center">
            <Text textStyle="heading/S">No work queued</Text>
            <Text color="fg.muted" textStyle="body/S">
              Create a row to start tracking work in this view.
            </Text>
          </Stack>
          <Button size="sm">
            <Plus />
            Create row
          </Button>
        </Stack>
      }
    />
  ),
};
export const SwitchView: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--switch-view",
  render: () => <Wrapper />,
};
// Testing Library's fireEvent copies the DataTransfer for each event, which drops the card id
// between dragstart and drop in a real browser. One shared DataTransfer keeps it, as a person's drag does.
export const DragAndDrop: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--drag-and-drop",
  render: () => <Wrapper />,
};
export const EmptyColumnPersists: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--empty-column-persists",
  render: () => <Wrapper />,
};
export const MultiValuedLabels: Story = {
  id: "patterns-kanban-renderer-kanban-renderer--multi-valued-labels",
  render: () => <Wrapper />,
};
