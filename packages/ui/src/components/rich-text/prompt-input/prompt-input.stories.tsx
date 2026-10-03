import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { PromptEditor, type PromptEditorProps } from "./prompt-input";
import { generateEditorStateFromString } from "./utils";

const meta: Meta<typeof PromptEditor> = {
  title: "Patterns/Editors/Prompt Editor",
  component: PromptEditor,
  parameters: { layout: "padded" },
  args: {
    defaultState: JSON.stringify(generateEditorStateFromString()),
    commands: [
      { name: "/plan", description: "Select native planning.", argumentHelp: "[task]" },
      { name: "/compact", description: "Compact this thread." },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof PromptEditor>;
export const Basic: Story = {};
export const ReadOnly: Story = { args: { isEditable: false } };
export const DebugView: Story = { args: { debug: true } };

export const SlashPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "/");
    await expect(await page.findByRole("listbox", { name: "Typeahead menu" })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(input.innerText).toBe("/compact ");
    await expect(page.queryByRole("listbox", { name: "Typeahead menu" })).not.toBeInTheDocument();
  },
};

export const FilterAndTab: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "/pl");
    await expect(await page.findAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Tab}");
    await expect(input.innerText).toBe("/plan ");
    await userEvent.type(input, "Keep my task text");
    await expect(input).toHaveTextContent("/plan Keep my task text");
  },
};

export const DismissPopover: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "/");
    await userEvent.keyboard("{Escape}");
    await expect(input).toHaveTextContent("/");
    await expect(page.queryByRole("listbox", { name: "Typeahead menu" })).not.toBeInTheDocument();
  },
};

export const MultilineDraft: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox");
    await userEvent.type(input, "/");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    await userEvent.type(input, "Keep this line");
    await expect(input.innerText).toContain("/\nKeep this line");
  },
};

const DiscoveringCommands = (props: PromptEditorProps) => {
  const { commands = [], ...editorProps } = props;
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query !== "/" || ready) return;
    const timer = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(timer);
  }, [query, ready]);
  return <PromptEditor {...editorProps} commands={ready ? commands : []} onChange={setQuery} />;
};
export const DelayedDiscovery: Story = {
  render: (args) => <DiscoveringCommands {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(canvas.getByRole("textbox"), "/");
    await expect(await page.findByRole("listbox", { name: "Typeahead menu" })).toBeVisible();
  },
};
