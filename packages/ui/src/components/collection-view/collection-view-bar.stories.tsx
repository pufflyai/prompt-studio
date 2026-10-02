import { Box, Icon, IconButton } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { CollectionViewBar } from "./collection-view-bar";
import { storyFields, storyFilter, storyOptions } from "./collection-view-story-fixtures";
import { type CollectionSavedView, EMPTY_VIEW_FILTER } from "./collection-view-types";
import { useCollectionViewStore } from "./use-collection-view-store";
import { useCollectionViews } from "./use-collection-views";

const meta: Meta<typeof CollectionViewBar> = {
  title: "Patterns/Collection View/Collection View Bar",
  component: CollectionViewBar,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

interface StorySettings {
  displayProperties: string[];
}

const settings: StorySettings = { displayProperties: [] };

interface BarProps {
  storageKey: string;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  /** Applied after the view loads, so the tab shows unsaved changes. */
  editedSorts?: ViewSort[];
}

const Bar = (props: BarProps) => {
  const { storageKey, filter = EMPTY_VIEW_FILTER, sorts = [], editedSorts } = props;
  const [savedViews, setSavedViews] = useState<(CollectionSavedView<StorySettings> & { builtIn: boolean })[]>([
    { id: "all", title: "All tickets", settings, filter, sorts, builtIn: true },
    { id: "mine", title: "My work", settings, filter: EMPTY_VIEW_FILTER, sorts: [], builtIn: false },
  ]);
  const [search, setSearch] = useState("");
  const initialState = { settings };
  const viewsSource = {
    views: savedViews,
    defaultViewId: "all",
    onCreateView: async (input: Omit<CollectionSavedView<StorySettings>, "id">) => {
      const view = { ...input, id: crypto.randomUUID(), builtIn: false };
      setSavedViews((current) => [...current, view]);
      return view;
    },
    onUpdateView: async (id: string, input: Partial<CollectionSavedView<StorySettings>>) =>
      setSavedViews((current) => current.map((view) => (view.id === id ? { ...view, ...input } : view))),
    onDeleteView: async (id: string) => setSavedViews((current) => current.filter((view) => view.id !== id)),
    onSetDefaultView: async () => undefined,
  };
  const views = useCollectionViews({ storageKey, initialState, viewsSource });
  const reset = useCollectionViewStore(storageKey, initialState, (state) => state.reset);
  const activateView = useCollectionViewStore(storageKey, initialState, (state) => state.activateView);
  const setSorts = useCollectionViewStore(storageKey, initialState, (state) => state.setSorts);
  // Each story starts from its first view, then applies its edits. This runs during the first
  // render, so the bar's own effects and the play function see the story's state.
  useState(() => {
    reset();
    if (savedViews[0]) activateView(savedViews[0]);
    if (editedSorts) setSorts(editedSorts);
  });

  return (
    <Box bg="bg">
      <CollectionViewBar
        storageKey={storageKey}
        initialState={initialState}
        views={views.views}
        defaultViewId={views.defaultId}
        viewsSource={viewsSource}
        fields={storyFields}
        optionsFor={storyOptions}
        search={search}
        onSearchChange={setSearch}
        searchResultLabel={search ? "4 of 10" : undefined}
        displayControl={
          <IconButton aria-label="Display settings" variant="ghost" size="2xs">
            <Icon as={Settings2} />
          </IconButton>
        }
      />
    </Box>
  );
};

export const NoRules: Story = {
  render: () => <Bar storageKey="storybook-collection-view-bar-no-rules" />,
};

/** Saved rules always show in the criteria row, so nothing that hides rows is invisible. */
export const RulesSaved: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-bar-saved"
      filter={storyFilter}
      sorts={[
        { attributeId: "priority", direction: "asc" },
        { attributeId: "updated", direction: "desc" },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Sorted by Priority" })).toHaveTextContent("+1");
    await expect(canvas.getByRole("button", { name: "Edit Status filter" })).toHaveTextContent("Status is notDone");
    await expect(canvas.queryByRole("button", { name: "Save view" })).not.toBeInTheDocument();
  },
};

/** An edit marks the tab and offers Reset and Save until the view is saved. */
export const UnsavedChanges: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-bar-unsaved"
      filter={storyFilter}
      editedSorts={[{ attributeId: "score", direction: "desc" }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Unsaved view changes")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save as new view" })).toBeVisible();
  },
};

/** Search is screen state: it never marks the view as changed. */
export const SearchOpen: Story = {
  render: () => <Bar storageKey="storybook-collection-view-bar-search" filter={storyFilter} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "filter");
    await expect(canvas.getByText("4 of 10")).toBeVisible();
    await expect(canvas.queryByLabelText("Unsaved view changes")).not.toBeInTheDocument();
  },
};
