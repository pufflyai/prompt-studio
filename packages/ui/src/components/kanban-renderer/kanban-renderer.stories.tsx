import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { Plus } from "lucide-react";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { KanbanRenderer } from "./kanban-renderer";
import { initialRows } from "./kanban-renderer-story-fixtures";
import { CreateFormWrapper, Wrapper } from "./kanban-renderer-story-wrappers";
import type { KanbanRendererSavedView, ViewMode } from "./types";

const meta: Meta<typeof KanbanRenderer> = {
  title: "Patterns/Kanban Renderer/Kanban Renderer",
  component: KanbanRenderer,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

const CHROME_UUID = "550e8400-e29b-41d4-a716-446655440000";
const chromeRows = initialRows.map((row, index) => {
  if (index === 0) return { ...row, id: CHROME_UUID, attributes: { ...row.attributes, id: "PS-1" } };
  if (index === 1) return { ...row, title: "PRA-1_A1", attributes: { ...row.attributes, id: "PRA-1_A1" } };
  return row;
});

const getLucideIconName = (element: HTMLElement) =>
  Array.from(element.classList).find((className) => className !== "lucide" && className.startsWith("lucide-"));

export const BoardView: Story = {
  render: () => <Wrapper />,
};

export const RendererChromeAndTicketMenu: Story = {
  tags: ["renderer-chrome-regression"],
  render: () => (
    <Wrapper
      storageKey="storybook-kanban-renderer-chrome"
      displayProperties={["id"]}
      withTicketMenu
      rows={chromeRows}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const renderer = canvas.getByTestId("kanban-renderer");
    const header = canvas.getByTestId("collection-view-bar");
    const firstCard = canvas.getAllByTestId("renderer-card")[0];
    if (!firstCard) throw new Error("Expected a ticket card to render");

    await expect(getComputedStyle(renderer).borderTopWidth).toBe("0px");
    await expect(getComputedStyle(header).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(canvas.getAllByTestId("column-status-icon")[0]).toBeVisible();
    const boardIconNames = canvas.getAllByTestId("column-status-icon").map(getLucideIconName);

    const filterButton = canvas.getByRole("button", { name: "Filter" });
    const displayButton = canvas.getByRole("button", { name: "Display settings" });
    const body = within(document.body);

    await userEvent.hover(filterButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Filter");
    await userEvent.unhover(filterButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());

    await userEvent.hover(displayButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Display");
    await userEvent.unhover(displayButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());

    fireEvent.contextMenu(firstCard);
    const menu = await body.findByRole("menu");
    await expect(menu.getBoundingClientRect().width).toBe(280);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Open ticket" }));
    await waitFor(() => expect(body.queryByRole("menu")).not.toBeInTheDocument());

    await userEvent.click(filterButton);
    const filterDialog = await body.findByRole("dialog");
    const filterButtonBounds = filterButton.getBoundingClientRect();
    const filterDialogBounds = filterDialog.getBoundingClientRect();
    // The popover opens under its button; near the window edge it shifts to stay on screen.
    await expect(filterDialogBounds.left).toBeLessThanOrEqual(filterButtonBounds.left + 1);
    await expect(filterDialogBounds.right).toBeGreaterThanOrEqual(filterButtonBounds.right - 1);
    await expect(filterDialogBounds.top).toBeGreaterThanOrEqual(filterButtonBounds.bottom);
    await userEvent.click(filterButton);
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(displayButton);
    const displayDialog = await body.findByRole("dialog");
    const displayButtonBounds = displayButton.getBoundingClientRect();
    await waitFor(() => {
      const bounds = displayDialog.getBoundingClientRect();
      expect(Math.abs(bounds.right - displayButtonBounds.right)).toBeLessThanOrEqual(1);
      expect(bounds.top).toBeGreaterThanOrEqual(displayButtonBounds.bottom);
    });
    await userEvent.click(within(displayDialog).getByRole("button", { name: "List" }));

    const ticketRow = await canvas.findByRole("option", { name: "Set up API authentication" });
    const ticketTag = within(ticketRow).getByTestId("list-row-eyebrow");
    await expect(ticketTag).toHaveTextContent("PS-1");
    await expect(canvas.getAllByText("PS-1")).toHaveLength(1);
    await expect(getComputedStyle(ticketTag).fontSize).toBe("10px");
    await expect(getComputedStyle(ticketTag.parentElement!).columnGap).toBe("10px");
    await expect(canvas.queryByText(CHROME_UUID)).not.toBeInTheDocument();
    const workspaceRow = canvas.getByRole("option", { name: "PRA-1_A1" });
    await expect(within(workspaceRow).queryByTestId("list-row-eyebrow")).not.toBeInTheDocument();
    await expect(canvas.getAllByText("PRA-1_A1")).toHaveLength(1);
    const listIconNames = canvas.getAllByTestId("list-status-icon").map(getLucideIconName);
    await expect(listIconNames).toEqual(boardIconNames);
    const rowStatusIcon = within(ticketRow).getByTestId("row-status-icon");
    await expect(getLucideIconName(rowStatusIcon)).toBe(boardIconNames[0]);
    await expect(getComputedStyle(rowStatusIcon.parentElement!.parentElement!).columnGap).toBe("10px");
  },
};

export const ListView: Story = {
  render: () => <Wrapper storageKey="storybook-kanban-renderer-list-view" viewMode="list" />,
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
  render: () => (
    <Wrapper storageKey="storybook-kanban-renderer-saved-views" defaultViews={SAVED_VIEWS} defaultActiveViewId="all" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addViewButton = canvas.getByRole("button", { name: "Add view" });
    const body = within(document.body);

    await userEvent.hover(addViewButton);
    await expect(await body.findByRole("tooltip")).toHaveTextContent("Add view");
    await userEvent.unhover(addViewButton);
    await waitFor(() => expect(body.queryByRole("tooltip")).not.toBeInTheDocument());
  },
};

export const SavedFilteredView: Story = {
  tags: ["saved-filter-row-regression"],
  render: () => (
    <Wrapper
      storageKey="storybook-kanban-renderer-saved-filtered-view"
      defaultViews={SAVED_VIEWS}
      defaultActiveViewId="my-work"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The renderer selects its saved view in an effect, which can run after the play function starts.
    const filterPill = (await canvas.findByRole("button", { name: "Remove Assignee filter" })).parentElement;
    if (!filterPill) throw new Error("Expected the saved filter pill to render");

    await expect(within(filterPill).getByText("Assignee", { exact: true })).toBeVisible();
    await expect(within(filterPill).getByRole("button", { name: "Condition" })).toHaveTextContent("is");
    await expect(within(filterPill).getByRole("button", { name: "Values" })).toHaveTextContent("Alex");
  },
};

export const RendererOwnedCreateForm: Story = {
  render: () => <CreateFormWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(within(canvas.getByTestId("board-column-todo")).getByRole("button", { name: "Create row" }));
    const dialog = within(await within(document.body).findByRole("dialog"));
    await expect(dialog.getByText("Todo")).toBeInTheDocument();
    await userEvent.type(await dialog.findByRole("textbox"), "Restore ticket creation");
    await userEvent.click(dialog.getByRole("button", { name: "Create ticket" }));
    await expect(
      await within(canvas.getByTestId("board-column-todo")).findByText("Restore ticket creation"),
    ).toBeInTheDocument();
  },
};

export const EmptyState: Story = {
  render: () => <Wrapper showEmptyState />,
};

export const CustomEmptyState: Story = {
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

const switchToListView = async (canvas: ReturnType<typeof within>) => {
  await userEvent.click(canvas.getByLabelText("Display settings"));
  await userEvent.click(within(document.body).getByText("List"));
};

export const SwitchView: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await switchToListView(canvas);
    await expect(canvas.getByText("Set up API authentication")).toBeInTheDocument();
  },
};

// Testing Library's fireEvent copies the DataTransfer for each event, which drops the card id
// between dragstart and drop in a real browser. One shared DataTransfer keeps it, as a person's drag does.
const dragCardTo = (card: Element, target: Element) => {
  const dataTransfer = new DataTransfer();
  const fire = (element: Element, type: string) =>
    element.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
  fire(card, "dragstart");
  fire(target, "dragover");
  fire(target, "drop");
  fire(card, "dragend");
};

export const DragAndDrop: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const doneColumn = canvas.getByTestId("board-column-done");
    await expect(within(doneColumn).getByText("Write docs")).toBeInTheDocument();

    dragCardTo(canvas.getByText("Write docs").closest("[draggable]")!, canvas.getByTestId("board-column-todo"));

    // The move saves the new status before the card changes columns.
    await expect(await within(canvas.getByTestId("board-column-todo")).findByText("Write docs")).toBeInTheDocument();
    await expect(within(canvas.getByTestId("board-column-done")).queryByText("Write docs")).not.toBeInTheDocument();
  },
};

export const EmptyColumnPersists: Story = {
  render: () => <Wrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    for (const title of ["Write docs", "Set up CI pipeline"]) {
      dragCardTo(canvas.getByText(title).closest("[draggable]")!, canvas.getByTestId("board-column-todo"));
      await expect(await within(canvas.getByTestId("board-column-todo")).findByText(title)).toBeInTheDocument();
    }

    await expect(canvas.getByTestId("board-column-done")).toBeInTheDocument();
  },
};

export const MultiValuedLabels: Story = {
  render: () => <Wrapper />,
};
