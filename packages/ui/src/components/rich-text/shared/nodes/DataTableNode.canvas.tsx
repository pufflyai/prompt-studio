import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { MarkdownEditor } from "../../markdown-editor/markdown-editor";
import { RichMessage } from "../../rich-message/rich-message";

const meta: CanvasMeta<typeof RichMessage> = {
  title: "Patterns/Chat/Data Table Node",
  component: RichMessage,
  description:
    "Chat tables wrap cells and hide row numbers by default. Display settings can change wrapping for each table independently.",
};
export default meta;
type Story = CanvasVariant<typeof RichMessage>;
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
  id: "patterns-chat-data-table-node--table-in-rich-text",
  args: {
    defaultState: tableMarkdown,
    debug: false,
  },
};
export const WrappedChatTable: Story = {
  id: "patterns-chat-data-table-node--wrapped-chat-table",
  args: {
    defaultState: `| Task | Details |
| --- | --- |
| Review | Read the proposed changes and confirm that the shared tools work together for people who never read the code. |`,
    fullWidth: true,
  },
};
export const IndependentTableViews: Story = {
  id: "patterns-chat-data-table-node--independent-table-views",
  render: () => (
    <>
      <MarkdownEditor defaultState={"| Task | Details |\n| --- | --- |\n| Review | Editor table |"} isEditable />
      <RichMessage defaultState={"| Task | Details |\n| --- | --- |\n| Review | First chat table |"} fullWidth />
      <RichMessage defaultState={"| Task | Details |\n| --- | --- |\n| Review | Second chat table |"} fullWidth />
    </>
  ),
};
export const DebugMode: Story = {
  id: "patterns-chat-data-table-node--debug-mode",
  args: {
    defaultState: tableMarkdown,
    debug: true,
  },
};
