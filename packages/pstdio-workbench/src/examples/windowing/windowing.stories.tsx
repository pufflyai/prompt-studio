import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { WindowingStory } from "./windowing-story";

const meta = {
  title: "pstdio-workbench/Guides/Windowing",
  component: WindowingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WindowingStory>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Smoke: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const draft = await canvas.findByRole("textbox", { name: "Files draft" });
    await expect(canvas.getByLabelText("Files mount")).toHaveTextContent("Mount 1");
    await userEvent.type(draft, "Keep this draft while hiding a panel");
    const mount = canvas.getByLabelText("Files mount").textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Hide Secondary Panel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Show Secondary Panel" }));
    await expect(draft).toHaveValue("Keep this draft while hiding a panel");
    await expect(canvas.getByLabelText("Files mount")).toHaveTextContent(mount!);
    await expect(canvas.getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 2" }));
    await expect(canvas.getByLabelText("Terminal binding")).toHaveTextContent("workspace-2");
    await userEvent.click(canvas.getByRole("button", { name: "Workspace 1" }));
    await expect(canvas.getByLabelText("Terminal binding")).toHaveTextContent("workspace-1");
    await userEvent.click(canvas.getByRole("button", { name: "Grow Secondary" }));
    const size = canvas.getByLabelText("Secondary size").textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(canvas.getByLabelText("Secondary size")).toHaveTextContent(size!);
    await expect(canvas.getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 0");
    await expect(canvas.getByRole("textbox", { name: "Files draft" })).toHaveValue("");
    await userEvent.click(canvas.getByRole("button", { name: "Stop Terminal 1" }));
    await expect(canvas.getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 1");
    await userEvent.click(canvas.getByRole("button", { name: "Reload fixture" }));
    await expect(canvas.getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 1 · Stops 1");
    await userEvent.click(canvas.getByRole("button", { name: "Start Terminal 1" }));
    await expect(canvas.getByLabelText("Terminal lifecycle")).toHaveTextContent("Starts 2 · Stops 1");
    await userEvent.click(canvas.getByRole("button", { name: "Note A" }));
    await expect(canvas.getByRole("textbox", { name: "Notes draft" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Note B" }));
    await expect(canvas.getByRole("textbox", { name: "Notes draft" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Sessions" }));
    await expect(canvas.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await expect(canvas.queryByRole("alert")).toBeNull();
  },
};

export const Webview: Story = {
  args: { initialPage: "webview" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('iframe[title="Windowing webview"]')).toBeVisible();
  },
};

export const Boombox: Story = {
  args: { mode: "boombox" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Like current track" }));
    await expect(canvas.getByRole("button", { name: "Unlike current track" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "New fixture" }));
    await expect(await canvas.findByRole("button", { name: "Like current track" })).toBeVisible();
  },
};

export const Kiln: Story = {
  args: { mode: "kiln" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const position = await canvas.findByRole("spinbutton", { name: "Cube position X" });
    const initialValue = (position as HTMLInputElement).valueAsNumber;
    await userEvent.clear(position);
    await userEvent.type(position, "2.5");
    await expect(position).toHaveValue(2.5);
    await userEvent.click(canvas.getByRole("button", { name: "New fixture" }));
    await expect(await canvas.findByRole("spinbutton", { name: "Cube position X" })).toHaveValue(initialValue);
  },
};
