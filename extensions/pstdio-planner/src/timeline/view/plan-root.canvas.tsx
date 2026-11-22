import { Box, Button, Flex } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState, useSyncExternalStore } from "react";
import { PlanRoot } from "./plan-root";
import { createTimelineFixture } from "./plan-root.fixture";

function TimelineStory(props: { failConfigure?: boolean; loading?: "tickets" | "preferences"; windowed?: boolean }) {
  const [fixture, setFixture] = useState(() => createTimelineFixture(props));
  useSyncExternalStore(fixture.subscribe, fixture.getSnapshot);
  return (
    <Flex h="600px" w="full" minW="0" direction="column">
      {props.windowed ? (
        <Flex gap="2" wrap="wrap" p="2">
          <Button size="xs" onClick={() => fixture.hold()}>
            Hold next window
          </Button>
          <Button size="xs" onClick={() => fixture.release()}>
            Release window
          </Button>
          <Button size="xs" onClick={() => fixture.release(true)}>
            Fail window
          </Button>
          <Button size="xs" onClick={() => fixture.reset("parallel")}>
            Parallel tickets
          </Button>
          <Button size="xs" onClick={() => fixture.reset("chain")}>
            Dependency chain
          </Button>
          <Button size="xs" onClick={() => fixture.reset("layers")}>
            Dependency layers
          </Button>
          <Button size="xs" onClick={() => fixture.reset()}>
            Switch project
          </Button>
          <Button size="xs" onClick={() => setFixture(createTimelineFixture(props))}>
            Replace host
          </Button>
          <output aria-label="Requested windows">{JSON.stringify(fixture.requests)}</output>
        </Flex>
      ) : null}
      <Box flex="1" minH="0" minW="0">
        <PlanRoot host={fixture.host} t={(_key, fallback) => fallback ?? _key} />
      </Box>
    </Flex>
  );
}
const meta: CanvasMeta<typeof TimelineStory> = {
  title: "Extensions/Planner/Timeline/Overview",
  component: TimelineStory,
};
export default meta;
type Story = CanvasFrame<typeof TimelineStory>;
export const LoadingTickets: Story = {
  id: "extensions-planner-timeline--loading-tickets",
  args: { loading: "tickets" },
};
export const LoadingPreferences: Story = {
  id: "extensions-planner-timeline--loading-preferences",
  ...LoadingTickets,
  args: { loading: "preferences" },
};
export const SavedAutoBuildFailure: Story = {
  id: "extensions-planner-timeline--saved-auto-build-failure",
};
export const ConfigureFailure: Story = {
  id: "extensions-planner-timeline--configure-failure",
  args: { failConfigure: true },
};
export const WindowedPlan: Story = {
  args: { windowed: true },
};
