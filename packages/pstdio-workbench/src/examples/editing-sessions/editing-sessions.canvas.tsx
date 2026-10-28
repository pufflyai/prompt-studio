import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EditingSessionsPlayground } from "./editing-sessions-playground.fixture";

const meta = {
  title: "pstdio-workbench/Reference/Extension API/Shared editing sessions",
  component: EditingSessionsPlayground,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Use the real SDK editing client, capability gate, host event publisher and host-owned save queue. Only the transport and persistence are in memory. Views share edits before saving, coalesce pending writes, and preview or cancel compound changes. Sandboxed iframe transport is covered by the packaged editing-session journeys.",
      },
    },
  },
} satisfies Meta<typeof EditingSessionsPlayground>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const HeldSavesAndGestures: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = within(await canvas.findByRole("region", { name: "View A" }));
    const second = within(canvas.getByRole("region", { name: "View B" }));
    const other = within(canvas.getByRole("region", { name: "Other document" }));
    const title = first.getByRole("textbox", { name: "View A title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Latest shared edit");
    await expect(second.getByRole("textbox", { name: "View B title" })).toHaveValue("Latest shared edit");
    await expect(other.getByRole("textbox", { name: "Other document title" })).toHaveValue("Original title");
    await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 1; completed: 0; held: 1");
    await expect(canvas.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title");
    await userEvent.click(first.getByRole("button", { name: "Select locally" }));
    await expect(first.getByLabelText("View A selection")).toHaveTextContent(/^Selected$/);
    await expect(second.getByLabelText("View B selection")).toHaveTextContent("Unselected");
    await userEvent.click(first.getByRole("button", { name: "Preview move" }));
    await expect(second.getByLabelText("View B position")).toHaveTextContent("Position: 12, 24");
    await expect(canvas.getByLabelText("Saved position")).toHaveTextContent("Saved position: 0, 0");
    await userEvent.click(first.getByRole("button", { name: "Cancel move" }));
    await expect(second.getByLabelText("View B position")).toHaveTextContent("Position: 0, 0");
    await userEvent.click(first.getByRole("button", { name: "Preview move" }));
    await userEvent.click(first.getByRole("button", { name: "Commit move" }));
    await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 1; completed: 0; held: 1");
    await userEvent.click(canvas.getByRole("button", { name: "Release saves" }));
    await waitFor(async () => {
      await expect(canvas.getByLabelText("Saved title")).toHaveTextContent("Saved title: Latest shared edit");
      await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 2; held: 0");
    });
    await expect(canvas.getByLabelText("Saved position")).toHaveTextContent("Saved position: 12, 24");
    await expect(second.getByRole("textbox", { name: "View B title" })).toHaveValue("Latest shared edit");
    await userEvent.click(first.getByRole("button", { name: "Preview move" }));
    await expect(second.getByLabelText("View B position")).toHaveTextContent("Position: 24, 48");
    await userEvent.click(first.getByRole("button", { name: "Cancel move" }));
    await expect(second.getByLabelText("View B position")).toHaveTextContent("Position: 12, 24");
    await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 2; held: 0");
  },
};

export const FailedSaveRetry: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = within(await canvas.findByRole("region", { name: "View A" }));
    const second = within(canvas.getByRole("region", { name: "View B" }));
    await userEvent.type(first.getByRole("textbox", { name: "View A title" }), " retained");
    await userEvent.click(canvas.getByRole("button", { name: "Fail held saves" }));
    await expect(await first.findByRole("alert")).toHaveTextContent("Save failed");
    await expect(second.getByRole("textbox", { name: "View B title" })).toHaveValue("Original title retained");
    await expect(canvas.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title");
    await userEvent.click(first.getByRole("button", { name: "Retry save" }));
    await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 0; held: 1");
    await userEvent.click(canvas.getByRole("button", { name: "Release saves" }));
    await waitFor(async () => {
      await expect(canvas.getByLabelText("Saved title")).toHaveTextContent("Saved title: Original title retained");
      await expect(canvas.getByLabelText("Save counts")).toHaveTextContent("Started: 2; completed: 1; held: 0");
    });
  },
};
