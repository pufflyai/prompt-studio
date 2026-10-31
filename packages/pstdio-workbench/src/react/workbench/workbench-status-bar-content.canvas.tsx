import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { createContext, useContext, useState } from "react";
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
} satisfies CanvasMeta<typeof Example>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const ActivityLifecycle: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar-content--activity-lifecycle",
};
