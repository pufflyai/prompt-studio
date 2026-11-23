import { Box, Flex, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Header } from "@pstdio/ui";
import type { CollectionViewsSource } from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { AutoBuildDialogPreview } from "./auto-build-dialog.story-fixture";
import { PlanHeader } from "./plan-header";
import { TimelinePresentationProvider } from "./timeline-presentation";
import { timelineInitialState } from "./timeline-query";

function HeaderStory(props: { filtered?: boolean; running?: boolean; obsoleteProperties?: boolean }) {
  const { filtered, running, obsoleteProperties } = props;
  const [search, setSearch] = useState("");
  const [views, setViews] = useState<CollectionViewsSource<KanbanRendererSettings>["views"]>([
    {
      id: "all",
      title: "All",
      ...timelineInitialState,
      settings: {
        ...timelineInitialState.settings,
        displayProperties: obsoleteProperties ? ["status", "reviewRequests", "deleted-tag"] : ["status"],
      },
      builtIn: true,
    },
    {
      id: "active",
      title: "In progress",
      ...timelineInitialState,
      filter: {
        conjunction: "and" as const,
        rules: [{ attributeId: "status", condition: "is-any-of" as const, value: ["progress"] }],
      },
      builtIn: false,
    },
  ]);
  const [defaultViewId, setDefaultViewId] = useState(filtered ? "active" : "all");
  const source: CollectionViewsSource<KanbanRendererSettings> = {
    views,
    defaultViewId,
    onCreateView: async (input) => {
      const view = { ...input, id: crypto.randomUUID(), builtIn: false };
      setViews((current) => [...current, view]);
      return view;
    },
    onUpdateView: async (id, input) =>
      setViews((current) => current.map((view) => (view.id === id ? { ...view, ...input } : view))),
    onDeleteView: async (id) => setViews((current) => current.filter((view) => view.id !== id)),
    onSetDefaultView: async (id) => setDefaultViewId(id ?? "all"),
  };
  return (
    <Box minW="0" w="full">
      <Header>
        <Text flex="1" textStyle="label/S/medium">
          Project Timeline
        </Text>
        <AutoBuildDialogPreview
          enabled={running ?? false}
          sessions={[]}
          running={0}
          capacity={2}
          onOpenSession={() => {}}
          onStop={async () => true}
          t={(_key, fallback) => fallback ?? _key}
        />
      </Header>
      <Flex direction="column">
        <PlanHeader
          data={{
            rows: [
              { id: "one", title: "Build the shared header", attributes: { status: "progress" } },
              { id: "two", title: "Review the result", attributes: { status: "ready" } },
            ],
            attributes: [
              { id: "title", label: "Title", type: { kind: "string" }, filterable: true },
              {
                id: "status",
                label: "Status",
                type: {
                  kind: "enum",
                  options: [
                    { value: "progress", label: "In progress", icon: "circle" },
                    { value: "ready", label: "Ready", icon: "circle" },
                  ],
                },
                filterable: true,
                displayable: true,
              },
            ],
            storageKey: `timeline-header-story:${filtered ? "filtered" : "all"}:${obsoleteProperties ? "obsolete" : "current"}`,
          }}
          viewsSource={source}
          search={search}
          onSearchChange={setSearch}
          resultLabel="2 of 2"
        />
      </Flex>
    </Box>
  );
}
const meta: CanvasMeta<typeof HeaderStory> = {
  title: "Extensions/Planner/Timeline header",
  component: HeaderStory,
  decorators: [
    (Story) => (
      <TimelinePresentationProvider projectId="timeline-header-story">
        <Story />
      </TimelinePresentationProvider>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof HeaderStory>;
export const SavedViews: Story = {
  id: "extensions-planner-timeline-header--saved-views",
};
export const FilteredView: Story = {
  id: "extensions-planner-timeline-header--filtered-view",
  args: { filtered: true },
};
export const AutoBuildRunning: Story = {
  id: "extensions-planner-timeline-header--auto-build-running",
  args: { running: true },
};
export const RetiredDisplayProperties: Story = {
  id: "extensions-planner-timeline-header--retired-display-properties",
  args: { obsoleteProperties: true },
};
