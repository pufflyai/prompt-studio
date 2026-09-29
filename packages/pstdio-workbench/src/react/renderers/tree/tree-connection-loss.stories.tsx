import { Button, Stack } from "@chakra-ui/react";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchConnectionProvider } from "../workbench-connection-provider";
import { WorkbenchTreeView } from "./tree-view";

const createFixture = () => {
  const workbench = createWorkbench();
  let failure: Error | undefined;
  workbench.views.registerView({
    id: "connection-navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      getBody: () => {
        if (failure) throw failure;
        return [{ id: "tools", nodes: [{ id: "notes", label: "Notes" }] }];
      },
    },
  });
  return {
    workbench,
    refresh(error?: Error) {
      failure = error;
      workbench.views.refreshView("connection-navigation");
    },
  };
};

const NavigationConnection = () => {
  const [fixture] = useState(createFixture);
  const [connected, setConnected] = useState(true);
  return (
    <Stack h="md" gap="md">
      <Button onClick={() => fixture.refresh(new PstdioConnectionError(new TypeError("Failed to fetch")))}>
        Drop response
      </Button>
      <Button onClick={() => setConnected(false)}>Disconnect</Button>
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
  },
};
