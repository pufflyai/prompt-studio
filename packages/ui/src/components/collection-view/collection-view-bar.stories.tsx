import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup, ViewSort } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DisplayMenu } from "../kanban-renderer/display-menu";
import { CollectionViewBar } from "./collection-view-bar";
import { storyFields, storyFilter, storyOptions } from "./collection-view-story-fixtures";
import { type CollectionSavedView, EMPTY_VIEW_FILTER } from "./collection-view-types";
import { DisplaySortControl } from "./display-sort-control";
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
  viewMode: "board" | "list";
  columnGrouping: string;
  rowGrouping: string;
}

const settings: StorySettings = {
  displayProperties: [],
  viewMode: "board",
  columnGrouping: "none",
  rowGrouping: "none",
};

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
  const currentSorts = useCollectionViewStore(storageKey, initialState, (state) => state.sorts);
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
        itemLabel="Ticket"
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
          <DisplayMenu
            settings={settings}
            groupingOptions={[]}
            displayPropertyOptions={[]}
            onViewModeChange={() => undefined}
            onColumnGroupingChange={() => undefined}
            onRowGroupingChange={() => undefined}
            onDisplayPropertyToggle={() => undefined}
            sortControl={<DisplaySortControl fields={storyFields} sorts={currentSorts} onSortsChange={setSorts} />}
          />
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
      sorts={[{ attributeId: "priority", direction: "asc" }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filter = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(filter.getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    await expect(filter.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
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

/** Booleans name a predicate; the operator selects its truth value. */
export const BooleanPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-boolean"
      filter={{ conjunction: "and", rules: [{ attributeId: "archived", condition: "is", value: false }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole("group", { name: "Archived filter" });
    await expect(within(pill).getByRole("button", { name: "Field" })).toHaveTextContent("Ticket");
    await expect(within(pill).getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(pill).getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is", exact: true }));
    await expect(within(pill).getByRole("button", { name: "Condition" })).toHaveTextContent("is");
  },
};

/** Both sort directions remain visible inside Display, which owns one ordering. */
export const NestedSortChoices: Story = {
  render: () => <Bar storageKey="storybook-sort-choices" sorts={[{ attributeId: "updated", direction: "desc" }]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    await userEvent.click(await body.findByRole("button", { name: "Sort direction" }));
    const menu = await body.findByRole("menu");
    const newest = within(menu).getByRole("menuitem", { name: "Newest first" });
    const oldest = within(menu).getByRole("menuitem", { name: "Oldest first" });
    await expect(newest.querySelector(".lucide-check")).toBeInTheDocument();
    await waitFor(() => {
      const bounds = menu.getBoundingClientRect();
      for (const option of [newest, oldest]) {
        const row = option.getBoundingClientRect();
        expect(row.top).toBeGreaterThanOrEqual(bounds.top);
        expect(row.bottom).toBeLessThanOrEqual(bounds.bottom);
      }
    });
    await userEvent.click(oldest);
    await userEvent.click(body.getByRole("button", { name: "Sort direction" }));
    const reopened = await body.findByRole("menu");
    await expect(
      within(reopened).getByRole("menuitem", { name: "Oldest first" }).querySelector(".lucide-check"),
    ).toBeInTheDocument();
    await userEvent.click(within(reopened).getByRole("menuitem", { name: "Newest first" }));
    await expect(body.getByRole("button", { name: "Sort direction" })).toHaveTextContent("Newest first");
    await userEvent.click(body.getByRole("button", { name: "Ordering" }));
    await userEvent.click(body.getByRole("menuitem", { name: "None", exact: true }));
    await expect(body.getByRole("button", { name: "Ordering" })).toHaveTextContent("None");
    await expect(body.queryByRole("button", { name: "Sort direction" })).not.toBeInTheDocument();
  },
};

/** Property, condition, and value are independent controls; values toggle without closing. */
export const IndependentFilterChoices: Story = {
  tags: ["!manifest"],
  render: () => (
    <Bar
      storageKey="storybook-independent-filter-choices"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo"] }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(pill.getByRole("button", { name: "Field" }).querySelector("svg")).toBeNull();
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await expect(body.getAllByRole("menuitem")).toHaveLength(2);
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    const todo = body.getByRole("menuitemcheckbox", { name: /Todo/ });
    const done = body.getByRole("menuitemcheckbox", { name: /Done/ });
    await expect(todo).toHaveAttribute("aria-checked", "true");
    await expect(todo.querySelector(".lucide-circle")).toBeInTheDocument();
    await userEvent.click(done);
    await expect(done).toHaveAttribute("aria-checked", "true");
    await expect(todo).toBeVisible();
    await userEvent.click(todo);
    await expect(todo).toHaveAttribute("aria-checked", "false");
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(pill.getByRole("button", { name: "Field" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Priority", exact: true }));
    await expect(canvas.getByRole("group", { name: "Priority filter" })).toBeVisible();
  },
};

/** Imported empty predicates keep their meaning until a real value is chosen. */
export const EmptyOptionPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-empty-option-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-empty" }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Empty");
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Empty");
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: /Done/ }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
    await expect(pill.getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    await userEvent.keyboard("{Escape}");
  },
};

/** Incoming all-value rules stay explicit and retain their condition while values change. */
export const AllValuesPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-all-values-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "labels", condition: "has-all-of", value: ["bug"] }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Labels filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug");
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is", exact: true }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug");
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: /Regression/ }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug, Regression");
    await userEvent.keyboard("{Escape}");
  },
};
