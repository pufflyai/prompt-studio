import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DependencyTimeline } from "./dependency-timeline";
import { DependencyTimelineExample } from "./dependency-timeline.examples";

const meta: Meta<typeof DependencyTimeline> = {
  title: "Components/Layout/Dependency Timeline",
  component: DependencyTimeline,
  render: (args) => (
    <DependencyTimelineExample
      onContext={args.onContext}
      onCreateSection={args.onCreateSection}
      selectedId={args.selectedId}
    />
  ),
  args: { onContext: fn(), onCreateSection: fn() },
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A dependency timeline with milestone sections and collapsible tracks, built on Canvas. Supply item content and section headers; the component owns layout, measured card heights, dependency edges, windowing, and navigation. Callers own data, saved presentation, and actions. Use the exported DependencyTimeline component and TimelineItem/TimelineSection/TimelineTrack types.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof DependencyTimeline>;

export const ReleasePlan: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Timeline draft" }), "Keep this draft");
    await userEvent.click(canvas.getByRole("button", { name: "Zoom out", exact: true }));
    await expect(canvas.getByRole("textbox", { name: "Timeline draft" })).toHaveValue("Keep this draft");
    await expect(canvas.getByRole("button", { name: /Reset zoom to 100%, current zoom 90%/ })).toBeVisible();
  },
};

export const CollapsibleTracksAndMilestones: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Collapse API", exact: true }));
    await expect(canvas.getByRole("button", { name: "Expand API", exact: true })).toBeVisible();
    await expect(canvas.queryByRole("textbox", { name: "Timeline draft" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Expand API", exact: true }));
    await userEvent.click(canvas.getByRole("button", { name: "Collapse Preview", exact: true }));
    await expect(canvas.queryByRole("textbox", { name: "Timeline draft" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Expand Preview", exact: true }));
    await expect(canvas.getByRole("textbox", { name: "Timeline draft" })).toBeVisible();
  },
};

export const Empty: Story = { render: () => <DependencyTimelineExample empty /> };
export const NoTracks: Story = {
  render: () => (
    <Box h="400px">
      <DependencyTimeline
        today="2026-10-10"
        tracks={[]}
        sections={[
          {
            id: "release",
            header: "Release",
            items: [{ id: "orphan", trackId: "missing", dependencies: [], content: "Unassigned item" }],
          },
        ]}
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Release")).toBeVisible();
    await expect(canvas.queryByText("Unassigned item")).toBeNull();
  },
};
export const SelectedDependencies: Story = { args: { selectedId: "ship" } };
export const LargePlan: Story = {
  tags: ["!manifest"],
  render: () => <DependencyTimelineExample large />,
  play: async ({ canvasElement }) => {
    const viewport = canvasElement.querySelector<HTMLElement>("[data-timeline-viewport]")!;
    await waitFor(() => expect(viewport.querySelectorAll("[data-timeline-item]").length).toBeLessThan(15));
    await expect(viewport.querySelectorAll("[data-edge-layer] path").length).toBeLessThan(60);
    viewport.scrollTop = viewport.scrollHeight;
    await waitFor(() => expect(viewport.querySelector('[data-timeline-item="work-999"]')).not.toBeNull());
    await expect(viewport.querySelectorAll("[data-edge-layer] path").length).toBeGreaterThan(0);
    await expect(viewport.querySelectorAll("[data-edge-layer] path").length).toBeLessThan(60);
  },
};

// Keep the public component visible in generated API documentation.
export const Minimal: Story = {
  render: () => (
    <Box h="400px">
      <DependencyTimeline today="2026-10-10" tracks={[{ id: "work", label: "Work" }]} sections={[]} />
    </Box>
  ),
};
