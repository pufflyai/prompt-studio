import { Button, Stack } from "@chakra-ui/react";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
  initialFailure?: Error;
  initiallyConnected?: boolean;
}

const NavigationConnection = (props: NavigationConnectionProps) => {
  const { initialFailure, initiallyConnected = true } = props;
  const [fixture] = useState(() => createFixture(initialFailure));
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
  title: "pstdio-workbench/Guides/Navigation connection loss",
  component: NavigationConnection,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof NavigationConnection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RetainNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "Notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Drop response" }));
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false"),
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await expect(canvas.getByRole("option", { name: "Notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Reconnect" }));
    await expect(canvas.getByRole("option", { name: "Notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Fail view" }));
    await expect(await canvas.findByText("This view has an invalid query.")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await expect(canvas.getByText("This view has an invalid query.")).toBeVisible();
  },
};

export const InitialConnectionFailure: Story = {
  args: { initialFailure: new PstdioConnectionError(new TypeError("Failed to fetch")) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Could not connect to the backend.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Retry" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Restore response" }));
    await userEvent.click(canvas.getByRole("button", { name: "Retry" }));
    await expect(await canvas.findByRole("option", { name: "Notes" })).toBeVisible();
  },
};

export const LocalReadDuringOutage: Story = {
  args: { initiallyConnected: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "Notes" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false");
  },
};

export const RetainCompletedNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("option", { name: "Notes" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Drop partial response" }));
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect" }));
    await expect(canvas.getByRole("option", { name: "Notes" })).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Reconnect" }));
    await expect(canvas.getByRole("option", { name: "Notes" })).toBeVisible();
  },
};
