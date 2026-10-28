import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const createFixture = (initialFailure: boolean) => {
  const workbench = createWorkbench();
  let failure = initialFailure;
  let reads = 0;
  const refresh = (fail: boolean) => {
    failure = fail;
    workbench.views.refreshView("navigation");
  };
  workbench.views.registerView({
    id: "navigation",
    title: "Navigation",
    body: {
      kind: "tree",
      getChildren: () => [],
      getHeader: () => [{ id: "header", nodes: [{ id: "search", label: "Search" }] }],
      getFooter: () => [{ id: "footer", nodes: [{ id: "settings", label: "Settings" }] }],
      getBody: () => {
        reads++;
        if (failure) throw new Error("Navigation refresh failed");
        return [{ id: "tools", nodes: [{ id: "notes", label: `Notes ${reads}` }] }];
      },
    },
  });
  workbench.views.registerView({
    id: "guide",
    title: "Navigation recovery",
    body: {
      kind: "react",
      render: () => (
        <Stack p="md" gap="md">
          <Button onClick={() => refresh(true)}>Fail refresh</Button>
          <Button onClick={() => refresh(false)}>Restore navigation</Button>
        </Stack>
      ),
    },
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.pages.registerPage({
    id: "guide",
    ref: { kind: "page", extensionId: "storybook", id: "guide" },
    modeId: "project",
    path: "",
    main: { kind: "view", view: { kind: "view", id: "guide" }, cardinality: "one" },
    slots: [],
  });
  workbench.shellPlacements.registerPlacement({
    id: "navigation",
    region: "sidenav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
  });
  workbench.pageLocations.setProject("storybook");
  workbench.pageLocations.navigate({ kind: "page", page: { kind: "page", extensionId: "storybook", id: "guide" } });
  return workbench;
};

const NavigationRecovery = (props: { initialFailure: boolean }) => {
  const { initialFailure } = props;
  const [workbench] = useState(() => createFixture(initialFailure));
  return <WorkbenchStory workbench={workbench} />;
};

const meta = {
  title: "pstdio-workbench/Guides/Navigation recovery",
  component: NavigationRecovery,
  args: { initialFailure: false },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NavigationRecovery>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FailedRefresh: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notes = await canvas.findByRole("option", { name: /^Notes / });
    const label = notes.textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Fail refresh" }));
    // Background reads retain the loaded snapshot without setting aria-busy.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false"),
    );
    await expect(notes).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await expect(canvas.getByRole("option", { name: "Search" })).toBeVisible();
    await expect(canvas.getByRole("option", { name: "Settings" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Restore navigation" }));
    await waitFor(() => expect(canvas.getByRole("option", { name: /^Notes / })).not.toHaveTextContent(label!));
  },
};

export const InitialFailure: Story = {
  args: { initialFailure: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("region", { name: "Navigation" })).toHaveAttribute("aria-busy", "false"),
    );
    await expect(canvas.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Restore navigation" }));
    await expect(await canvas.findByRole("option", { name: /^Notes / })).toBeVisible();
    await expect(canvas.getByRole("option", { name: "Search" })).toBeVisible();
    await expect(canvas.getByRole("option", { name: "Settings" })).toBeVisible();
  },
};
