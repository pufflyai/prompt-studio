import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DEFAULT_DATA_TABLE_SETTINGS } from "@pstdio/sdk/extensions";
import { useState } from "react";
import type { AttributeDescriptor } from "../kanban-renderer/types";
import { DataTableDisplayMenu } from "./data-table-display-menu";
import { reorderDataTableColumns, toggleHiddenDataTableColumn } from "./data-table-state";
import type { DataTableSettings } from "./types";

const meta: CanvasMeta<typeof DataTableDisplayMenu> = {
  title: "Patterns/Data Table/Display Menu",
  component: DataTableDisplayMenu,
};
export default meta;
type Story = CanvasFrame;
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
  id: "patterns-data-table-display-menu--defaults",
  render: () => <Menu />,
};
export const GroupedWithRowNumbersOff: Story = {
  id: "patterns-data-table-display-menu--grouped-with-row-numbers-off",
  render: () => <Menu settings={{ grouping: "Status", rowNumbers: false }} />,
};
export const HiddenColumn: Story = {
  id: "patterns-data-table-display-menu--hidden-column",
  render: () => <Menu settings={{ hiddenColumns: ["Score"] }} />,
};
/** Statistics shows only when a column declares a stat. */
export const NoStatisticsAvailable: Story = {
  id: "patterns-data-table-display-menu--no-statistics-available",
  render: () => <Menu statsAvailable={false} />,
};
