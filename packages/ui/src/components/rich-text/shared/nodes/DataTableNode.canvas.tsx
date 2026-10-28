import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { MarkdownEditor } from "../../markdown-editor/markdown-editor";
import { RichMessage } from "../../rich-message/rich-message";

const meta: Meta<typeof RichMessage> = {
  title: "Patterns/Chat/Data Table Node",
  component: RichMessage,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Chat tables wrap cells and hide row numbers by default. Display settings can change wrapping for each table independently.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof RichMessage>;

const tableMarkdown = `# DataTableNode Demo

This demonstrates how markdown tables are rendered using the new DataTableNode instead of editable table nodes.

## Simple Table

| Name | Age | Department |
|------|-----|------------|
| Alice| 28  | Engineering|
| Bob  | 34  | Design     |
| Carol| 31  | Marketing  |

## Data Types Table

| Field | Value | Type | Active |
|-------|-------|------|--------|
| Temperature | 23.5 | number | true |
| Status | Running | string | true |
| Count | 42 | number | false |
| Mode | Auto | string | true |

This table shows different data types that are properly handled by the DataTable component with appropriate icons and formatting.
`;

export const TableInRichText: Story = {
  args: {
    defaultState: tableMarkdown,
    debug: false,
  },
};

export const WrappedChatTable: Story = {
  args: {
    defaultState: `| Task | Details |
| --- | --- |
| Review | Read the proposed changes and confirm that the shared tools work together for people who never read the code. |`,
    fullWidth: true,
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const cell = await canvas.findByRole("cell", { name: /Read the proposed changes/ });
    await expect(canvasElement.querySelector('[data-column-id="rowIndex"]')).toBeNull();
    await expect(getComputedStyle(cell).whiteSpace).toBe("normal");
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    const toggle = await body.findByRole("switch", { name: "Wrap rows" });
    await expect(toggle).toBeChecked();
    await userEvent.click(body.getByText("Wrap rows", { exact: true }));
    await expect(getComputedStyle(cell).whiteSpace).toBe("nowrap");
    await userEvent.click(body.getByText("Wrap rows", { exact: true }));
    await userEvent.keyboard("{Escape}");
  },
};

export const IndependentTableViews: Story = {
  render: () => (
    <>
      <MarkdownEditor defaultState={"| Task | Details |\n| --- | --- |\n| Review | Editor table |"} isEditable />
      <RichMessage defaultState={"| Task | Details |\n| --- | --- |\n| Review | First chat table |"} fullWidth />
      <RichMessage defaultState={"| Task | Details |\n| --- | --- |\n| Review | Second chat table |"} fullWidth />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("cell", { name: "Second chat table" });
    const tables = canvasElement.querySelectorAll('table[data-edit-mode="true"]');
    await expect(tables[0]?.querySelector('[data-column-id="rowIndex"]')).not.toBeNull();
    await expect(tables[1]?.querySelector('[data-column-id="rowIndex"]')).toBeNull();
    await expect(tables[2]?.querySelector('[data-column-id="rowIndex"]')).toBeNull();
    const firstChatCell = canvas.getByRole("cell", { name: "First chat table" });
    const secondChatCell = canvas.getByRole("cell", { name: "Second chat table" });
    await expect(getComputedStyle(firstChatCell).whiteSpace).toBe("normal");
    await expect(getComputedStyle(secondChatCell).whiteSpace).toBe("normal");
    await userEvent.click(canvas.getAllByRole("button", { name: "Display settings" })[1]!);
    const dialog = within(await body.findByRole("dialog"));
    await userEvent.click(dialog.getByText("Wrap rows", { exact: true }));
    await expect(getComputedStyle(firstChatCell).whiteSpace).toBe("nowrap");
    await expect(getComputedStyle(secondChatCell).whiteSpace).toBe("normal");
    await userEvent.keyboard("{Escape}");
  },
};

export const DebugMode: Story = {
  args: {
    defaultState: tableMarkdown,
    debug: true,
  },
};
