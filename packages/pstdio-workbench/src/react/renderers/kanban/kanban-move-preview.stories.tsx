import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchKanbanView } from "./kanban-view";

const DeferredMove = (props: { viewMode?: "board" | "list" }) => {
  const { viewMode = "board" } = props;
  const [pending, setPending] = useState<Array<(success: boolean) => void>>([]);
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    let rows = [{ id: "task", title: "Review ticket filters", attributes: { status: "backlog" } }];
    renderers.registerKanbanRenderer({
      id: "deferred-move",
      title: "Tasks",
      attributes: [
        {
          id: "status",
          label: "Status",
          groupable: true,
          displayable: true,
          editable: true,
          type: {
            kind: "enum",
            options: [
              { value: "backlog", label: "Backlog" },
              { value: "ready", label: "Ready" },
              { value: "done", label: "Done" },
            ],
          },
        },
      ],
      defaultSettings: { viewMode, columnGrouping: "status", rowGrouping: "none", displayProperties: ["status"] },
      executeQuery: () => rows,
      getBoardColumnConfig: () => ({ canDragIn: true, canDragOut: true, canCreate: false }),
      onAttributeChange: (rowId, attributeId, value) =>
        new Promise<void>((resolve, reject) => {
          const finish = (success: boolean) => {
            if (success) {
              rows = rows.map((row) =>
                row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
              );
              resolve();
            } else reject(new Error("Status save failed"));
          };
          setPending((current) => [...current, finish]);
        }),
    });
    return { workbench, contribution: renderers.getKanbanRenderer("deferred-move")! };
  });
  const finish = (success: boolean) => {
    pending[0]?.(success);
    setPending((current) => current.slice(1));
  };
  return (
    <WorkbenchThemeProvider>
      <Stack height="xl">
        <HStack>
          <Button onClick={() => finish(true)}>Finish save</Button>
          <Button onClick={() => finish(false)}>Reject save</Button>
          <Text>{pending.length} saves pending</Text>
        </HStack>
        <Box flex="1" minH="0">
          <WorkbenchKanbanView
            workbench={fixture.workbench}
            contribution={fixture.contribution}
            placement={{ instanceId: "deferred-move", panelId: "deferred-move", closable: false }}
          />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};

const meta: Meta = { title: "Renderers/Kanban/Move Preview", tags: ["!manifest"] };
export default meta;

const dropIntoReady = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const source = await canvas.findByTestId("renderer-card");
  const target = canvas.getByTestId("board-column-ready");
  const dataTransfer = new DataTransfer();
  const event = (type: string) => new DragEvent(type, { dataTransfer, bubbles: true, cancelable: true });
  source.dispatchEvent(event("dragstart"));
  target.dispatchEvent(event("dragover"));
  target.dispatchEvent(event("drop"));
  source.dispatchEvent(event("dragend"));
  await canvas.findByText("1 saves pending");
  await waitFor(() => expect(within(target).getByText("Review ticket filters")).toBeVisible());
  return canvas;
};

export const MoveBeforeSave: StoryObj = {
  render: () => <DeferredMove />,
  play: async ({ canvasElement }) => {
    const canvas = await dropIntoReady(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await canvas.findByText("0 saves pending");
    await expect(within(canvas.getByTestId("board-column-ready")).getByText("Review ticket filters")).toBeVisible();
  },
};

export const RestoreAfterFailure: StoryObj = {
  render: () => <DeferredMove />,
  play: async ({ canvasElement }) => {
    const canvas = await dropIntoReady(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Reject save" }));
    await waitFor(() =>
      expect(within(canvas.getByTestId("board-column-backlog")).getByText("Review ticket filters")).toBeVisible(),
    );
  },
};

const changeStatus = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  const card = await canvas.findByLabelText("Review ticket filters");
  await userEvent.click(within(card).getByText("Backlog"));
  await userEvent.click(within(document.body).getByRole("menuitemradio", { name: /^Ready$/ }));
  await canvas.findByText("1 saves pending");
  return canvas;
};

export const PropertyBeforeSave: StoryObj = {
  render: () => <DeferredMove />,
  play: async ({ canvasElement }) => {
    const canvas = await changeStatus(canvasElement);
    const target = canvas.getByTestId("board-column-ready");
    await expect(within(target).getByText("Review ticket filters")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await canvas.findByText("0 saves pending");
    await expect(within(target).getByText("Review ticket filters")).toBeVisible();
  },
};

export const PropertyFailure: StoryObj = {
  render: () => <DeferredMove />,
  play: async ({ canvasElement }) => {
    const canvas = await changeStatus(canvasElement);
    await expect(within(canvas.getByTestId("board-column-ready")).getByText("Review ticket filters")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reject save" }));
    await waitFor(() =>
      expect(within(canvas.getByTestId("board-column-backlog")).getByText("Review ticket filters")).toBeVisible(),
    );
  },
};

export const ListPropertyBeforeSave: StoryObj = {
  render: () => <DeferredMove viewMode="list" />,
  play: async ({ canvasElement }) => {
    const canvas = await changeStatus(canvasElement);
    await expect(within(canvas.getByLabelText("Review ticket filters")).getByText("Ready")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await canvas.findByText("0 saves pending");
    await expect(within(canvas.getByLabelText("Review ticket filters")).getByText("Ready")).toBeVisible();
  },
};

export const LaterPropertySurvivesFailure: StoryObj = {
  render: () => <DeferredMove />,
  play: async ({ canvasElement }) => {
    const canvas = await changeStatus(canvasElement);
    await userEvent.click(within(canvas.getByLabelText("Review ticket filters")).getByText("Ready"));
    await userEvent.click(within(document.body).getByRole("menuitemradio", { name: /^Done$/ }));
    const target = canvas.getByTestId("board-column-done");
    await expect(within(target).getByText("Review ticket filters")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reject save" }));
    await canvas.findByText("1 saves pending");
    await expect(within(target).getByText("Review ticket filters")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish save" }));
    await canvas.findByText("0 saves pending");
    await expect(within(target).getByText("Review ticket filters")).toBeVisible();
  },
};
