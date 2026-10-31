import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { DependencyTimeline } from "./dependency-timeline";
import { DependencyTimelineExample } from "./dependency-timeline.examples";

const meta: CanvasMeta<typeof DependencyTimeline> = {
  title: "Components/Layout/Dependency Timeline",
  component: DependencyTimeline,
  render: (args) => (
    <DependencyTimelineExample
      onContext={args.onContext}
      onCreateSection={args.onCreateSection}
      selectedId={args.selectedId}
    />
  ),
  args: { onContext: () => {}, onCreateSection: () => {} },
  description:
    "A dependency timeline with milestone sections and collapsible tracks, built on Canvas. Supply item content and section headers; the component owns layout, measured card heights, dependency edges, windowing, and navigation. Callers own data, saved presentation, and actions. Use the exported DependencyTimeline component and TimelineItem/TimelineSection/TimelineTrack types.",
  fullscreen: true,
};
export default meta;
type Story = CanvasFrame<typeof DependencyTimeline>;
export const ReleasePlan: Story = {
  id: "components-layout-dependency-timeline--release-plan",
};
export const CollapsibleTracksAndMilestones: Story = {
  id: "components-layout-dependency-timeline--collapsible-tracks-and-milestones",
};
export const Empty: Story = {
  id: "components-layout-dependency-timeline--empty",
  render: () => <DependencyTimelineExample empty />,
};
export const NoTracks: Story = {
  id: "components-layout-dependency-timeline--no-tracks",
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
};
export const SelectedDependencies: Story = {
  id: "components-layout-dependency-timeline--selected-dependencies",
  args: { selectedId: "ship" },
};
export const LargePlan: Story = {
  id: "components-layout-dependency-timeline--large-plan",
  render: () => <DependencyTimelineExample large />,
};
// Keep the public component visible in generated API documentation.
export const Minimal: Story = {
  id: "components-layout-dependency-timeline--minimal",
  render: () => (
    <Box h="400px">
      <DependencyTimeline today="2026-10-10" tracks={[{ id: "work", label: "Work" }]} sections={[]} />
    </Box>
  ),
};
