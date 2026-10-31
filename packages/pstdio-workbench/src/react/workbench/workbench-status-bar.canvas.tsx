import { Box, Button, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ComponentProps } from "react";
import { createWorkbench } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchStatusBar } from "./workbench-panels";

const workbench = createWorkbench();
const registerItem = (input: { id: string; label: string; order: number; slot: "leading" | "trailing" }) => {
  workbench.views.registerView({
    id: input.id,
    title: input.label,
    body: {
      kind: "react",
      render: () => (
        <Text textStyle="xs" px="sm">
          {input.label}
        </Text>
      ),
    },
  });
  workbench.statusBar.registerItem({
    id: `${input.id}.status-bar-item`,
    viewId: input.id,
    slot: input.slot,
    order: input.order,
  });
};
registerItem({ id: "planner.branch", label: "main", order: 20, slot: "leading" });
registerItem({ id: "sync.connection", label: "Connected", order: 10, slot: "leading" });
registerItem({ id: "tasks.progress", label: "3 tasks", order: 10, slot: "trailing" });
const meta = {
  title: "pstdio-workbench/Reference/Core API/Status bar",
  component: WorkbenchStatusBar,
  description:
    "The host status-bar registry places registered views on its leading or trailing side and centers each item vertically. Extensions reach it through defineStatusBarItem.",
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStatusBar>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const SeveralOwnersInOrder: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--several-owners-in-order",
  args: { workbench },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box h="2rem" w="full">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
};
const reorderWorkbench = createWorkbench();
for (const title of ["Connection", "Performance"]) {
  reorderWorkbench.views.registerView({
    id: title,
    title,
    body: {
      kind: "react",
      render: () => (
        <Text textStyle="label/XS" px="xs">
          {title}
        </Text>
      ),
    },
  });
  reorderWorkbench.statusBar.registerItem({ id: title, viewId: title, slot: "trailing" });
}
export const ReorderableItems: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--reorderable-items",
  ...SeveralOwnersInOrder,
  args: { workbench: reorderWorkbench },
  description:
    "Drag a widget directly, like a tab, to reorder it. Focus a widget or its control and use Alt+Left or Alt+Right to reorder with the keyboard. Items keep their leading or trailing slot.",
};
const mixedWorkbench = createWorkbench();
for (const slot of ["leading", "trailing"] as const) {
  for (const kind of ["label", "button"] as const) {
    const id = `${slot}.${kind}`;
    mixedWorkbench.views.registerView({
      id,
      title: id,
      body: {
        kind: "react",
        render: () =>
          kind === "label" ? (
            <Text textStyle="xs" px="sm">
              {slot} status
            </Text>
          ) : (
            <Button size="xs" variant="ghost">
              {slot} action
            </Button>
          ),
      },
    });
    mixedWorkbench.statusBar.registerItem({ id, viewId: id, slot });
  }
}
export const MixedItemHeights: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--mixed-item-heights",
  ...SeveralOwnersInOrder,
  args: { workbench: mixedWorkbench },
  description: "Text and buttons in both slots share the vertical center without layout wrappers in the views.",
};
// Items often appear later, for example when a setting turns a feature on.
const lateWorkbench = createWorkbench();
lateWorkbench.views.registerView({
  id: "late.item",
  title: "Late item",
  body: {
    kind: "react",
    render: () => (
      <Text textStyle="xs" px="sm">
        Registered after mount
      </Text>
    ),
  },
});
lateWorkbench.views.registerView({
  id: "first.item",
  title: "First item",
  body: {
    kind: "react",
    render: () => (
      <Text textStyle="xs" px="sm">
        First item
      </Text>
    ),
  },
});
lateWorkbench.statusBar.registerItem({ id: "first.item", viewId: "first.item", slot: "leading" });
export const ItemRegisteredAfterMount: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--item-registered-after-mount",
  ...SeveralOwnersInOrder,
  args: { workbench: lateWorkbench },
};
const detailWorkbench = createWorkbench();
detailWorkbench.modes.registerMode({ id: "active", activate: () => undefined });
detailWorkbench.modes.registerMode({ id: "other", activate: () => undefined });
detailWorkbench.modes.registerMode({ id: "replaced", chrome: { status: false }, activate: () => undefined });
detailWorkbench.views.registerView({
  id: "status.trigger",
  title: "Activity",
  body: {
    kind: "react",
    render: () => (
      <Text textStyle="label/XS" px="xs">
        Activity
      </Text>
    ),
  },
});
detailWorkbench.views.registerView({
  id: "status.details",
  title: "Activity details",
  body: { kind: "react", render: () => <Text textStyle="paragraph/S/regular">Activity details</Text> },
});
detailWorkbench.statusBar.registerItem({
  id: "activity",
  viewId: "status.trigger",
  popoverViewId: "status.details",
  slot: "trailing",
  isVisible: () => detailWorkbench.modes.getActiveModeId() !== "other",
});
const StatusDetailsExample = (props: ComponentProps<typeof WorkbenchStatusBar>) => {
  const { workbench } = props;
  const fullscreen = useWorkbenchStore(workbench.fullscreen.store, (state) => state.active);
  return <WorkbenchStatusBar {...props} visible={props.visible !== false && !fullscreen} />;
};
export const DetailPopover: Story = {
  id: "pstdio-workbench-reference-core-api-status-bar--detail-popover",
  ...SeveralOwnersInOrder,
  args: { workbench: detailWorkbench },
  render: (args) => <StatusDetailsExample {...args} />,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box h="20rem" display="flex" alignItems="end">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
};
