import { Button, Text } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import { useShowcaseStore } from "../showcases/showcase-store";
import type { WindowingFixture } from "./fixture";

export const WindowingSessionStartControls = (props: { fixture: WindowingFixture }) => {
  const { fixture } = props;
  const state = useShowcaseStore(fixture.probe.store);
  const started = fixture.resources.sessions.flatMap((resource) => state.sessions[resourceKey(resource)] ?? []);
  return (
    <>
      <Button size="xs" variant="outline" onClick={() => fixture.startSession(fixture.resources.workspaces[1]!)}>
        Start agent session
      </Button>
      <Text aria-label="Started session lifecycle" textStyle="paragraph/XS/regular">
        Starts {started.reduce((total, session) => total + session.starts, 0)} · Stops{" "}
        {started.reduce((total, session) => total + session.stops, 0)}
      </Text>
    </>
  );
};
