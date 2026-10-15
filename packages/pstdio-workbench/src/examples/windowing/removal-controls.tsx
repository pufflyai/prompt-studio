import { Button, HStack, Text } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { useShowcaseStore } from "../showcases/showcase-store";
import type { WindowingFixture } from "./fixture";
import { windowingExtensionId, windowingPages } from "./resources";

export const WindowingRemovalControls = (props: { fixture: WindowingFixture }) => {
  const { fixture } = props;
  const { workbench, resources, probe } = fixture;
  const [result, setResult] = useState("");
  const { sessions: runtime } = useShowcaseStore(probe.store);
  const run = async (action: () => unknown) => {
    try {
      await action();
      setResult("Success");
    } catch (error) {
      setResult(String(error));
    }
  };
  return (
    <HStack p="sm" gap="sm" flexWrap="wrap">
      {(["workspace", "mode", "panel"] as const).map((kind) => (
        <Button key={kind} size="xs" variant="outline" onClick={() => void run(() => fixture.removeContribution(kind))}>
          Remove {kind} contribution
        </Button>
      ))}
      <Button size="xs" variant="outline" onClick={() => fixture.removeResource(resources.workspaces[0]!)}>
        Delete Workspace 1
      </Button>
      <Button size="xs" variant="outline" onClick={() => fixture.removeResource(resources.sessions[1]!)}>
        Delete Session 2
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          const mode = workbench.modes.getMode("windowing");
          workbench.sidePanel.setMode("closed");
          if (mode) mode.panels = ["main", "secondary"];
        }}
      >
        Forbid Sidebar
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() =>
          void run(() =>
            workbench.navigation.openTarget({
              kind: "panel",
              panel: { kind: "placement", extensionId: windowingExtensionId, id: "sessions" },
              resource: resources.sessions[1],
              open: "pin",
            }),
          )
        }
      >
        Reopen Session 2
      </Button>
      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          const next = workbench.pageLocations.navigate({
            kind: "page",
            page: windowingPages.workspace,
            resource: resources.workspaces[0],
          });
          setResult(next.ok ? "Success" : next.diagnostic.message);
        }}
      >
        Try Workspace 1
      </Button>
      <Button size="xs" variant="outline" onClick={() => workbench.resetPageLayout()}>
        Reset layout
      </Button>
      <Text aria-label="Removal result" textStyle="paragraph/XS/regular">
        {result}
      </Text>
      {Object.entries(runtime).map(([key, session]) => (
        <Text
          key={key}
          aria-label={`${[...resources.sessions, ...resources.terminals].find((item) => resourceKey(item) === key)?.label} runtime`}
          textStyle="paragraph/XS/regular"
        >
          Starts {session.starts} · Stops {session.stops} · {session.running ? "Running" : "Stopped"}
        </Text>
      ))}
    </HStack>
  );
};
