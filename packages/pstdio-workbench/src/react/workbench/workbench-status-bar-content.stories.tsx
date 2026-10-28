import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createContext, useContext, useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WORKBENCH_STATUS_BAR_HEIGHT, WorkbenchStatusBar } from "./workbench-panels";

const Activity = createContext({ active: false, finish: () => {} });
const ActivityTrigger = () => {
  const { active } = useContext(Activity);
  return active ? <Text textStyle="label/XS/regular">Installing</Text> : null;
};
const ActivityDetails = () => {
  const { finish } = useContext(Activity);
  return <Button onClick={finish}>Finish installation</Button>;
};
const workbench = createWorkbench();
workbench.views.registerView({
  id: "progress",
  title: "Installation progress",
  body: { kind: "react", render: () => <ActivityTrigger /> },
});
workbench.views.registerView({
  id: "details",
  title: "Installation details",
  body: { kind: "react", render: () => <ActivityDetails /> },
});
workbench.statusBar.registerItem({ id: "progress", viewId: "progress", popoverViewId: "details", slot: "leading" });

const Example = () => {
  const [active, setActive] = useState(false);
  return (
    <WorkbenchThemeProvider>
      <Activity.Provider value={{ active, finish: () => setActive(false) }}>
        <Stack p="md" h="20rem" justify="space-between">
          <Button alignSelf="start" onClick={() => setActive(true)}>
            Start installation
          </Button>
          <Box h={WORKBENCH_STATUS_BAR_HEIGHT}>
            <WorkbenchStatusBar workbench={workbench} />
          </Box>
        </Stack>
      </Activity.Provider>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Status bar content",
  component: Example,
  tags: ["status-content"],
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActivityLifecycle: Story = {
  play: async ({ canvas, canvasElement }) => {
    const bar = canvasElement.querySelector('[data-workbench-region="status"]')!;
    await waitFor(() => expect(bar.getBoundingClientRect().height).toBe(0));
    await expect(canvas.queryByRole("button", { name: "Installation progress" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Start installation" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Installation progress" })).toBeVisible());
    await expect(bar.getBoundingClientRect().height).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: "Installation progress" }));
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Installation details"]')).toBeVisible(),
    );
    const finish = document.querySelector('[role="dialog"] button') as HTMLButtonElement;
    await userEvent.click(finish);
    await waitFor(() => expect(canvas.queryByRole("button", { name: "Installation progress" })).toBeNull());
    await waitFor(() =>
      expect(document.querySelector('[role="dialog"][aria-label="Installation details"]')).toBeNull(),
    );
    await waitFor(() => expect(bar.getBoundingClientRect().height).toBe(0));
    await userEvent.click(canvas.getByRole("button", { name: "Start installation" }));
    await waitFor(() => expect(canvas.getByRole("button", { name: "Installation progress" })).toBeVisible());
    canvasElement.dataset.statusContentChecked = "true";
  },
};
