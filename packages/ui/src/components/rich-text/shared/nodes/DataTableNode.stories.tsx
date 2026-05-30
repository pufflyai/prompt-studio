import type { Meta, StoryObj } from "@storybook/react";
import { RichMessage } from "../../rich-message/rich-message";

const meta: Meta<typeof RichMessage> = {
  title: "Patterns/Chat/Data Table Node",
  component: RichMessage,
  parameters: {
    layout: "padded",
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

export const DebugMode: Story = {
  args: {
    defaultState: tableMarkdown,
    debug: true,
  },
};
