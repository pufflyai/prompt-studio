import { Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { CollectionBadge } from "./collection-badge";
import { KanbanRenderer } from "./kanban-renderer";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "type",
    label: "Type",
    type: {
      kind: "enum",
      options: [
        { value: "thread", label: "Threads" },
        { value: "post", label: "Post ideas" },
      ],
    },
    groupable: true,
  },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "new", label: "New", icon: "circle", color: "purple" },
        { value: "saved", label: "Saved", icon: "circle-dot", color: "yellow" },
      ],
    },
    groupable: true,
  },
  {
    id: "site",
    label: "Site",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "text" },
    listColumn: { placement: "start", size: "sm" },
  },
  {
    id: "mention",
    label: "Mention",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "text" },
    listColumn: { placement: "start", size: "2xs" },
  },
  {
    id: "ideas",
    label: "Ideas",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "text" },
    listColumn: { placement: "end", size: "lg" },
  },
  {
    id: "url",
    label: "Open source",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "link" },
    listColumn: { placement: "end", size: "xs" },
  },
  {
    id: "date",
    label: "Date",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "text" },
    listColumn: { placement: "end", size: "md", align: "end" },
  },
];
const rows: KanbanRendererRow[] = [
  {
    id: "one",
    title: "Anyone built internal tools?",
    attributes: {
      type: "thread",
      status: "new",
      site: "RDT",
      ideas: "1 idea",
      url: "https://example.com/one",
      date: "07:12",
    },
  },
  {
    id: "two",
    title: "Prompt Studio on Windows",
    attributes: {
      type: "thread",
      status: "new",
      site: "X",
      mention: "@",
      url: "https://example.com/two",
      date: "05:58",
    },
  },
  {
    id: "three",
    title: "A new tool for agent review",
    attributes: {
      type: "post",
      status: "new",
      site: "BSKY",
      ideas: "Demo",
      date: "07:10",
    },
  },
];

const Columns = (props: { narrow?: boolean; mixed?: boolean; board?: boolean }) => {
  const { narrow, mixed, board } = props;
  const [opened, setOpened] = useState("");
  const mixedAttributes: AttributeDescriptor[] = mixed
    ? [
        {
          id: "tag",
          label: "Tag",
          type: { kind: "string" },
          displayable: true,
          render: (value) =>
            value ? <CollectionBadge label={String(value)} onClick={() => setOpened("badge")} /> : null,
        },
      ]
    : [];
  const displayProperties = [
    "site",
    "mention",
    "ideas",
    "url",
    "date",
    ...mixedAttributes.map((attribute) => attribute.id),
  ];
  const listRows = mixed
    ? rows.map((row, index) => ({
        ...row,
        attributes: { ...row.attributes, tag: index === 0 ? "Long ordinary badge" : undefined },
      }))
    : rows;
  const storyRows = board
    ? [
        ...listRows,
        {
          id: "empty",
          title: "Empty display values",
          attributes: { type: "thread", status: "new", url: "javascript:alert(1)" },
        },
      ]
    : listRows;
  return (
    <Stack maxW={narrow ? "md" : "full"}>
      <KanbanRenderer
        rows={storyRows}
        attributes={[...attributes, ...mixedAttributes]}
        storageKey={`fixed-columns-${narrow ? "narrow" : "wide"}-${mixed ? "mixed" : "plain"}-${board ? "board" : "list"}`}
        defaultSettings={{
          viewMode: board ? "board" : "list",
          columnGrouping: "type",
          rowGrouping: "status",
          displayProperties,
        }}
        onRowClick={(row) => setOpened(row.title)}
      />
      <Text role="status">{opened ? `Opened: ${opened}` : "No row opened"}</Text>
    </Stack>
  );
};
const meta: Meta<typeof Columns> = {
  title: "Patterns/Kanban Renderer/Fixed Columns",
  component: Columns,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Columns>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const source = (await canvas.findAllByRole("link", { name: "Open source" }))[0];
    await expect(source).toHaveAttribute("href", "https://example.com/one");
    await expect(source).toHaveAttribute("target", "_blank");
    const firstRow = canvas.getByRole("option", { name: "Anyone built internal tools?" });
    const secondRow = canvas.getByRole("option", { name: "Prompt Studio on Windows" });
    for (const id of ["site", "mention", "ideas", "url", "date"]) {
      const first = firstRow.querySelector(`[data-list-column="${id}"]`)!.getBoundingClientRect();
      const second = secondRow.querySelector(`[data-list-column="${id}"]`)!.getBoundingClientRect();
      await expect(Math.abs(first.x - second.x)).toBeLessThan(1);
      await expect(first.width).toBe(second.width);
    }
    await userEvent.click(secondRow);
    await expect(canvas.getByRole("status")).toHaveTextContent("Opened: Prompt Studio on Windows");
    firstRow.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("Opened: Anyone built internal tools?");
    secondRow.focus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("status")).toHaveTextContent("Opened: Prompt Studio on Windows");
  },
};
export const Narrow: Story = { args: { narrow: true } };
export const MixedBadges: Story = {
  args: { mixed: true },
  play: async (context) => {
    await Default.play?.(context);
    const canvas = within(context.canvasElement);
    const badge = canvas.getByRole("button", { name: "Long ordinary badge" });
    badge.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("Opened: badge");
    await userEvent.click(canvas.getByRole("option", { name: "Prompt Studio on Windows" }));
    badge.focus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("status")).toHaveTextContent("Opened: badge");
  },
};
export const Board: Story = { args: { board: true } };
