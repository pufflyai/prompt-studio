import { Box } from "@chakra-ui/react";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { DataTableDisplayMenu } from "./data-table-display-menu";
import { reorderDataTableColumns, toggleHiddenDataTableColumn } from "./data-table-state";
import type { DataTableSettings } from "./types";

const meta: Meta<typeof DataTableDisplayMenu> = {
  title: "Patterns/Data Table/Display Menu",
  component: DataTableDisplayMenu,
};

export default meta;

type Story = StoryObj;

const columns: AttributeDescriptor[] = [
  { id: "ID", label: "ID", type: { kind: "string" } },
  { id: "Title", label: "Title", type: { kind: "string" } },
  { id: "Status", label: "Status", type: { kind: "string" }, groupable: true },
  { id: "Priority", label: "Priority", type: { kind: "string" }, groupable: true },
  { id: "Updated", label: "Updated", type: { kind: "date" } },
  { id: "Score", label: "Score", type: { kind: "number" } },
];

interface MenuProps {
  settings?: Partial<DataTableSettings>;
  statsAvailable?: boolean;
}

const Menu = (props: MenuProps) => {
  const [settings, setSettings] = useState({ ...DEFAULT_DATA_TABLE_SETTINGS, ...props.settings });
  const ordered = columns.map((column) => column.id);
  return (
    <Box padding="lg">
      <DataTableDisplayMenu
        columns={columns}
        settings={settings}
        statsAvailable={props.statsAvailable ?? true}
        onSettingsChange={(next) => setSettings((current) => ({ ...current, ...next }))}
        onColumnVisibilityChange={(id, visible) =>
          setSettings((current) => ({
            ...current,
            hiddenColumns: toggleHiddenDataTableColumn(current.hiddenColumns, id, visible),
          }))
        }
        onColumnReorder={(active, over) =>
          setSettings((current) => ({ ...current, columnOrder: reorderDataTableColumns(ordered, active, over) }))
        }
      />
    </Box>
  );
};

export const Defaults: Story = {
  render: () => <Menu />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Display settings" }));
    await expect(await within(document.body).findByText("6 of 6 shown")).toBeVisible();
  },
};

export const GroupedWithRowNumbersOff: Story = {
  render: () => <Menu settings={{ grouping: "Status", rowNumbers: false }} />,
};

export const HiddenColumn: Story = {
  render: () => <Menu settings={{ hiddenColumns: ["Score"] }} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Display settings" }));
    await expect(await within(document.body).findByText("5 of 6 shown")).toBeVisible();
  },
};

/** Statistics shows only when a column declares a stat. */
export const NoStatisticsAvailable: Story = {
  render: () => <Menu statsAvailable={false} />,
};
