import type { CollectionViewsSource } from "@pstdio/ui/collection-view";
import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { defaultDisplay } from "../model/display";
import { PlanHeader } from "./plan-header";
import { timelineInitialState } from "./timeline-query";

function HeaderStory(props: { filtered?: boolean }) {
  const { filtered } = props;
  const [search, setSearch] = useState("");
  const [display, setDisplay] = useState(defaultDisplay);
  const [views, setViews] = useState<CollectionViewsSource<KanbanRendererSettings>["views"]>([
    { id: "all", title: "All", ...timelineInitialState, builtIn: true },
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
          },
        ],
        storageKey: `timeline-header-story:${filtered ? "filtered" : "all"}`,
      }}
      viewsSource={source}
      display={display}
      onDisplayChange={(change) => setDisplay((current) => ({ ...current, ...change }))}
      search={search}
      onSearchChange={setSearch}
      resultLabel="2 of 2"
    />
  );
}

const meta: Meta<typeof HeaderStory> = {
  title: "Extensions/Planner/Timeline header",
  component: HeaderStory,
};
export default meta;
type Story = StoryObj<typeof HeaderStory>;
export const SavedViews: Story = {};
export const FilteredView: Story = { args: { filtered: true } };
