import { Box } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor } from "storybook/test";
import { emptyWorkflowStatuses } from "../../data/workflow-statuses";
import type { PlanTag } from "../contracts";
import { buildPlan } from "../model/build-plan";
import { PlanGraph } from "./plan-graph";
import { relationsFor, useViewSections } from "./plan-state";
import { visibleTracks } from "./visible-tracks";

const track: PlanTag = {
  id: "track",
  name: "Track",
  type: "single_select",
  sortOrder: 0,
  options: ["API", "UI", "Docs"].map((name, sortOrder) => ({
    id: name.toLowerCase(),
    name,
    color: "gray",
    sortOrder,
    icon: null,
    description: null,
  })),
};

const ticket = (id: string, trackId: string | null, dependsOn: string[] = [], statusId: string | null = null) => ({
  id,
  shorthand: id.toUpperCase(),
  title: `${id.toUpperCase()} work`,
  content: "",
  statusId,
  tagIds: trackId ? [trackId] : [],
  dependsOn,
});

// Same-track, cross-track, completed, and upward links, plus one ticket without a track.
const plan = buildPlan({
  workflow: { ...emptyWorkflowStatuses(), completedStatusIds: ["done"] },
  statuses: [
    {
      id: "done",
      name: "Done",
      color: "green",
      sortOrder: 0,
      isDefault: false,
      canCreate: true,
      columnActions: [],
    },
  ],
  tags: [track],
  track,
  today: "2026-10-10",
  tickets: [
    ticket("a-1", "api", [], "done"),
    ticket("a-2", "api", ["a-1"]),
    ticket("u-1", "ui", ["a-1", "d-1"]),
    ticket("u-2", "ui", ["a-2"]),
    ticket("d-1", "docs"),
    ticket("n-1", null, ["u-1"]),
  ],
  plan: {
    deadlines: [
      { id: "preview", date: "2026-10-15", name: "Preview" },
      { id: "launch", date: "2026-10-22", name: "Launch" },
    ],
    order: [
      { ticketId: "a-1", deadlineId: "preview" },
      { ticketId: "u-1", deadlineId: "preview" },
      { ticketId: "a-2", deadlineId: "launch" },
      { ticketId: "u-2", deadlineId: "launch" },
      { ticketId: "d-1", deadlineId: "launch" },
      { ticketId: "n-1", deadlineId: "launch" },
    ],
  },
});

const rows = plan.sections.flatMap((section) => section.rows);
const fields: AttributeDescriptor[] = [
  {
    id: "track",
    label: "Track",
    type: { kind: "enum", options: track.options.map(({ id, name }) => ({ value: id, label: name })) },
    filterable: true,
  },
];

function TrackGraphStory(props: { filter: ViewFilterGroup; selectedId?: string; height?: number }) {
  const { filter, selectedId, height = 640 } = props;
  const tracks = visibleTracks(plan, filter, fields);
  const visibleIds = rows.filter((row) => tracks.list.some(({ id }) => id === (row.trackId ?? "unassigned")));
  const { sections, toggle } = useViewSections(plan, new Set(visibleIds.map(({ id }) => id)));
  return (
    <Box h={`${height}px`}>
      <PlanGraph
        sections={sections}
        tracks={tracks}
        today={plan.today}
        selectedId={selectedId}
        relations={relationsFor(
          rows.find(({ id }) => id === selectedId),
          plan,
        )}
        onToggle={toggle}
        onContext={() => {}}
        onSelect={() => {}}
        onDragStart={() => {}}
        onDragTarget={() => {}}
        onDrop={() => {}}
        onDelete={() => {}}
        onRenameDeadline={async () => {}}
        onRedate={async () => {}}
        onRenameTrack={async () => {}}
        onReview={() => {}}
        onNewTrack={() => {}}
        onCreateDeadline={() => {}}
      />
    </Box>
  );
}

const meta: Meta<typeof TrackGraphStory> = {
  title: "Extensions/Planner/Timeline graph/Tracks",
  component: TrackGraphStory,
  args: { filter: { conjunction: "and", rules: [] } },
};
export default meta;
type Story = StoryObj<typeof TrackGraphStory>;

export const CurvedDependencies: Story = {};
export const SelectedHierarchy: Story = { args: { selectedId: "u-1" } };
export const FilteredTracks: Story = {
  args: {
    filter: { conjunction: "and", rules: [{ attributeId: "track", condition: "is-any-of", value: ["api", "docs"] }] },
  },
};
export const UnassignedOnly: Story = {
  args: { filter: { conjunction: "and", rules: [{ attributeId: "track", condition: "is-empty" }] } },
};

export const TrackpadNavigation: Story = {
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>("[data-timeline-viewport]")!;
    const scale = () => Number.parseFloat(getComputedStyle(viewport.firstElementChild!).zoom);
    const { left, top } = viewport.getBoundingClientRect();
    const point = { bubbles: true, cancelable: true, clientX: left + 200, clientY: top + 200 };
    viewport.dispatchEvent(new WheelEvent("wheel", { ...point, deltaX: 120, deltaY: 80 }));
    await waitFor(() => {
      expect(viewport.scrollLeft).toBe(120);
      expect(viewport.scrollTop).toBe(80);
      expect(scale()).toBe(1);
    });
    viewport.dispatchEvent(new WheelEvent("wheel", { ...point, ctrlKey: true, deltaY: 300 }));
    await waitFor(() => expect(scale()).toBeLessThan(1));
    const zoom = scale();
    const anchor = (viewport.scrollLeft + 200) / zoom;
    viewport.dispatchEvent(new WheelEvent("wheel", { ...point, ctrlKey: true, deltaY: -100 }));
    await waitFor(() => {
      expect(scale()).toBeGreaterThan(zoom);
      expect((viewport.scrollLeft + 200) / scale()).toBeCloseTo(anchor, 0);
    });
  },
};

export const SelectedTrackpadNavigation: Story = {
  ...TrackpadNavigation,
  args: { selectedId: "a-1" },
};

export const MovingPinchAnchor: Story = {
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>("[data-timeline-viewport]")!;
    const { left, top } = viewport.getBoundingClientRect();
    viewport.scrollTo(200, 80);
    for (const [x, deltaY] of [
      [100, 30],
      [400, -30],
    ]) {
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          clientX: left + x,
          clientY: top + 200,
          deltaY,
        }),
      );
    }
    await waitFor(() => {
      expect(Number.parseFloat(getComputedStyle(viewport.firstElementChild!).zoom)).toBe(1);
      expect(viewport.scrollLeft).toBeGreaterThan(200);
    });
  },
};

export const TouchNavigation: Story = {
  args: { height: 360 },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

export const KeyboardAfterPan: Story = {
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>("[data-timeline-viewport]")!;
    const { left, top } = viewport.getBoundingClientRect();
    const point = { pointerId: 1, button: 0, bubbles: true, clientX: left + 600, clientY: top + 400 };
    viewport.dispatchEvent(new PointerEvent("pointerdown", point));
    viewport.dispatchEvent(new PointerEvent("pointermove", { ...point, clientX: point.clientX - 40 }));
    viewport.dispatchEvent(new PointerEvent("pointerup", point));
    const button = canvasElement.querySelector<HTMLButtonElement>('[aria-label="Collapse API"]')!;
    button.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvasElement.querySelector('[aria-label="Expand API"]')).not.toBeNull());
  },
};
