import { Box, HStack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { CollectionViewTabs } from "./collection-view-tabs";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";

const views = Array.from({ length: 18 }, (_, index) => ({
  id: String(index),
  title: `Team view ${index + 1}`,
  settings: {},
  filter: EMPTY_VIEW_FILTER,
  sorts: [],
  builtIn: false,
}));
const longTitle = "Team planning and research for the upcoming desktop release";
const CrowdedTabs = (props: { longLabel?: boolean }) => {
  const { longLabel } = props;
  const [activeViewId, setActiveViewId] = useState("0");
  return (
    <Box width="full" maxW="24rem">
      <HStack gap="2xs">
        <CollectionViewTabs
          views={longLabel ? views.map((view, index) => (index === 1 ? { ...view, title: longTitle } : view)) : views}
          activeViewId={activeViewId}
          dirty={false}
          busy={false}
          state={views[0]!}
          onActivate={(view) => setActiveViewId(view.id)}
          run={(action) => void action()}
          createView={async () => undefined}
        />
      </HStack>
      <Text data-testid="active-view">{activeViewId}</Text>
    </Box>
  );
};
const meta: CanvasMeta = {
  title: "Patterns/Collection View/View Tabs",
};
export default meta;
type Story = CanvasVariant;
const ReorderableTabs = (props: { crowded?: boolean }) => {
  const { crowded } = props;
  const [savedViews, setSavedViews] = useState(views.slice(0, crowded ? 18 : 3));
  const [activeViewId, setActiveViewId] = useState("0");
  const source = {
    views: savedViews,
    defaultViewId: "0",
    onCreateView: async () => savedViews[0]!,
    onUpdateView: async () => undefined,
    onDeleteView: async () => undefined,
    onSetDefaultView: async () => undefined,
    onReorderViews: async (ids: string[]) => setSavedViews(ids.map((id) => savedViews.find((view) => view.id === id)!)),
  };
  return (
    <Box width="full" maxW={crowded ? "24rem" : undefined}>
      <HStack>
        <CollectionViewTabs
          views={savedViews}
          viewsSource={source}
          activeViewId={activeViewId}
          dirty
          busy={false}
          state={savedViews[0]!}
          onActivate={(view) => setActiveViewId(view.id)}
          run={(action) => void action()}
          createView={async () => undefined}
        />
      </HStack>
    </Box>
  );
};
export const ReorderViews: Story = {
  id: "patterns-collection-view-view-tabs--reorder-views",
  render: () => <ReorderableTabs />,
};
export const CrowdedReordering: Story = {
  id: "patterns-collection-view-view-tabs--crowded-reordering",
  render: () => <ReorderableTabs crowded />,
};
export const ManyViews: Story = {
  id: "patterns-collection-view-view-tabs--many-views",
  render: () => <CrowdedTabs />,
};
export const FullTitle: Story = {
  id: "patterns-collection-view-view-tabs--full-title",
  render: () => <CrowdedTabs longLabel />,
};
