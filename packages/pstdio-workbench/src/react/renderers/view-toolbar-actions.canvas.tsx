import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import type { ViewToolbarAction } from "../../core/registries/renderers/view-toolbar-action";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { ViewToolbarActions } from "./view-toolbar-actions";

const actions: ViewToolbarAction[] = [
  { id: "run", label: "Run experiment", presentation: "primary" },
  { id: "refresh", label: "Refresh results" },
];
const Toolbar = (props: { actions: ViewToolbarAction[] }) => {
  const { actions } = props;
  const [workbench] = useState(() => createWorkbench());
  const [lastAction, setLastAction] = useState("None");
  return (
    <Stack p="sm">
      <HStack gap="2xs">
        <Button size="2xs" variant="ghost">
          Filter
        </Button>
        <Button size="2xs" variant="ghost">
          Display
        </Button>
        <ViewToolbarActions
          workbench={workbench}
          actions={actions.map((action) => ({ ...action, run: () => setLastAction(action.label ?? action.id) }))}
        />
      </HStack>
      <Text>Last action: {lastAction}</Text>
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Native toolbar actions",
  component: Toolbar,
  args: { actions },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof Toolbar>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const VisibleActions: Story = {
  id: "pstdio-workbench-reference-core-api-native-toolbar-actions--visible-actions",
};
export const NoActions: Story = {
  id: "pstdio-workbench-reference-core-api-native-toolbar-actions--no-actions",
  args: { actions: [] },
};
export const HiddenActions: Story = {
  id: "pstdio-workbench-reference-core-api-native-toolbar-actions--hidden-actions",
  args: { actions: actions.map((action) => ({ ...action, when: "false" })) },
};
