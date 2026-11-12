import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { useState } from "react";
import { createWorkbench } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchConnectionProvider } from "../workbench-connection-provider";
import { WorkbenchTreeView } from "./tree-view";

const createFixture = (initialFailure?: Error) => {
  const workbench = createWorkbench();
  let failure = initialFailure;
  let publishPartial = false;
  workbench.views.registerView({
    id: "connection-navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      getBody: (ctx) => {
        if (publishPartial) ctx?.onProgress?.([]);
        if (failure) throw failure;
        return [{ id: "tools", nodes: [{ id: "notes", label: "Notes" }] }];
      },
    },
  });
  return {
    workbench,
    refresh(error?: Error, partial = false) {
      failure = error;
      publishPartial = partial;
      workbench.views.refreshView("connection-navigation");
    },
    restore() {
      failure = undefined;
    },
  };
};
interface NavigationConnectionProps {
  initiallyUnavailable?: boolean;
  initiallyConnected?: boolean;
}
const NavigationConnection = (props: NavigationConnectionProps) => {
  const { initiallyUnavailable = false, initiallyConnected = true } = props;
  const [fixture] = useState(() =>
    createFixture(initiallyUnavailable ? new PstdioConnectionError(new TypeError("Failed to fetch")) : undefined),
  );
  const [connected, setConnected] = useState(initiallyConnected);
  return (
    <Stack h="md" gap="md">
      <Button onClick={() => fixture.refresh(new PstdioConnectionError(new TypeError("Failed to fetch")))}>
        Drop response
      </Button>
      <Button onClick={() => setConnected(false)}>Disconnect</Button>
      <Button onClick={() => fixture.refresh(new PstdioConnectionError(new TypeError("Failed to fetch")), true)}>
        Drop partial response
      </Button>
      <Button onClick={() => fixture.restore()}>Restore response</Button>
      <Button
        onClick={() => {
          fixture.refresh();
          setConnected(true);
        }}
      >
        Reconnect
      </Button>
      <Button onClick={() => fixture.refresh(new Error("This view has an invalid query."))}>Fail view</Button>
      <WorkbenchConnectionProvider connected={connected}>
        <WorkbenchTreeView workbench={fixture.workbench} treeViewId="connection-navigation" />
      </WorkbenchConnectionProvider>
    </Stack>
  );
};
const meta = {
  title: "Product/Workbench/Navigation/Tree/Navigation connection loss",
  description:
    "Connection failures recover silently. Keep loaded content, wait quietly on an initial failure, and restore the response to observe automatic recovery. View errors still offer Retry.",
  component: NavigationConnection,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof NavigationConnection>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RetainNavigation: Story = {
  id: "pstdio-workbench-guides-navigation-connection-loss--retain-navigation",
};
export const InitialConnectionFailure: Story = {
  id: "pstdio-workbench-guides-navigation-connection-loss--initial-connection-failure",
  description: "The live connection may still be healthy when a page request drops. Never show a connection error banner.",
  args: { initiallyUnavailable: true },
};
export const LocalReadDuringOutage: Story = {
  id: "pstdio-workbench-guides-navigation-connection-loss--local-read-during-outage",
  args: { initiallyConnected: false },
};
export const RetainCompletedNavigation: Story = {
  id: "pstdio-workbench-guides-navigation-connection-loss--retain-completed-navigation",
};
