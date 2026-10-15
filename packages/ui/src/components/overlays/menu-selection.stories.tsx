import { Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { PaginationFooter } from "../data-table/pagination-footer";
import { DiffViewerOptionsMenu } from "../diff-viewer/diff-viewer-options-menu";
import { SelectionMenu } from "../param-editor/inputs/selection-menu";

const MenuSelectionExamples = () => {
  const [selected, setSelected] = useState("ready");
  const [pageSize, setPageSize] = useState(10);
  return (
    <Stack gap="md" align="start" p="md">
      <SelectionMenu
        triggerLabel="Status"
        options={[
          { id: "ready", name: "Ready" },
          { id: "waiting", name: "Waiting" },
        ]}
        selectedIds={[selected]}
        multiSelect={false}
        onToggle={setSelected}
      />
      <DiffViewerOptionsMenu
        isTreePanelOpen
        hasFilePaths
        viewMode="nested"
        diffViewMode="unified"
        isExpandAllDisabled={false}
        isCollapseAllDisabled={false}
        onToggleTreePanel={() => {}}
        onViewModeChange={() => {}}
        onDiffViewModeChange={() => {}}
        onExpandAll={() => {}}
        onCollapseAll={() => {}}
      />
      <PaginationFooter
        pageCount={2}
        pageIndex={0}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50]}
        onPageChange={() => {}}
        onPageSizeChange={setPageSize}
      />
    </Stack>
  );
};

const meta = { title: "Components/Overlays/Menu/Selection", component: MenuSelectionExamples } satisfies Meta<
  typeof MenuSelectionExamples
>;
export default meta;
type Story = StoryObj<typeof meta>;

const checkSelectedRow = async (name: string) => {
  const row = within(document.body).getByRole("menuitemradio", { name, exact: true });
  const check = row.querySelector('[data-part="item-indicator"] svg, [id$="-end"] svg')!;
  await expect(check).not.toBeNull();
  await expect(row.getBoundingClientRect().right - check.getBoundingClientRect().right).toBeLessThan(16);
  await userEvent.keyboard("{End}");
  await userEvent.hover(document.body);
  await expect(getComputedStyle(row).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  await userEvent.keyboard("{Escape}");
};

export const PlainAndRadioMenus: Story = {
  play: async () => {
    const canvas = within(document.body);
    await userEvent.click(canvas.getByRole("button", { name: "Status" }));
    await checkSelectedRow("Ready");
    await userEvent.click(canvas.getByRole("button", { name: "Diff view options" }));
    await checkSelectedRow("Nested");
    await userEvent.click(canvas.getByRole("button", { name: "10", exact: true }));
    await checkSelectedRow("10");
  },
};
