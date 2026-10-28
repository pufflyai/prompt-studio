import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { CollectionViewBar } from "./collection-view-bar";
import { Bar } from "./collection-view-bar-story";
import { storyFilter } from "./collection-view-story-fixtures";

const meta: CanvasMeta<typeof CollectionViewBar> = {
  title: "Patterns/Collection View/Filter Row",
  component: CollectionViewBar,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = CanvasVariant;
export const ManyFilters: Story = {
  id: "patterns-collection-view-filter-row--many-filters",
  render: () => (
    <Box width="full" maxW="folder-picker-width">
      <Bar
        storageKey="storybook-many-filter-criteria"
        filter={storyFilter}
        editedSorts={[{ attributeId: "score", direction: "desc" }]}
      />
    </Box>
  ),
};
