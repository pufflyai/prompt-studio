import { Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ScopedPopover as Popover, Portal, Tooltip, UiScopeActivity } from "@pstdio/ui";
import { Activity, useState } from "react";
import { createWorkbench, type WorkbenchCore } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";

const pageRef = (id: string) => ({ kind: "page", extensionId: "preview", id }) as const;

const OverlayControls = (props: { workbench: WorkbenchCore; label: string; destination: string }) => {
  const { workbench, label, destination } = props;
  const [open, setOpen] = useState(false);
  const navigate = () => void workbench.navigation.openTarget({ kind: "page", page: pageRef(destination) });
  return (
    <Stack p="md" align="start">
      <Input aria-label={`${label} draft`} />
      {[false, true].map((controlled) => (
        <Popover.Root
          key={String(controlled)}
          {...(controlled ? { open, onOpenChange: (details: { open: boolean }) => setOpen(details.open) } : {})}
        >
          <Popover.Trigger asChild>
            <Button>
              {label} {controlled ? "controlled" : "uncontrolled"} options
            </Button>
          </Popover.Trigger>
          <Portal>
            <Popover.Positioner>
              <Popover.Content aria-label={`${label} ${controlled ? "controlled" : "uncontrolled"} options`}>
                <Popover.Body>
                  <Button onClick={navigate}>Navigate from options</Button>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Portal>
        </Popover.Root>
      ))}
      <Tooltip content={`${label} help`}>
        <Button
          onKeyDown={(event) => {
            if (event.key === "n") navigate();
          }}
        >
          {label} help
        </Button>
      </Tooltip>
    </Stack>
  );
};

const createOverlayWorkbench = () => {
  const workbench = createWorkbench();
  workbench.modes.registerMode({ id: "first", label: "First", chrome: { sidenav: "chrome" }, activate() {} });
  workbench.modes.registerMode({ id: "other", label: "Other", activate() {} });
  workbench.views.registerView({
    id: "status",
    title: "Status help",
    body: {
      kind: "react",
      render: () => (
        <Tooltip content="Status help">
          <Button
            size="xs"
            onKeyDown={(event) => {
              if (event.key === "n") void workbench.navigation.openTarget({ kind: "page", page: pageRef("other") });
            }}
          >
            Status help
          </Button>
        </Tooltip>
      ),
    },
  });
  workbench.statusBar.registerItem({
    id: "status",
    viewId: "status",
    slot: "leading",
    isVisible: () => workbench.modes.getActiveModeId() === "first",
  });
  workbench.views.registerView({
    id: "chrome",
    title: "Chrome",
    body: { kind: "react", render: () => <OverlayControls workbench={workbench} label="Chrome" destination="other" /> },
  });
  workbench.views.registerView({
    id: "main",
    title: "Main",
    body: { kind: "react", render: () => <OverlayControls workbench={workbench} label="Main" destination="two" /> },
  });
  workbench.views.registerView({
    id: "destination",
    title: "Destination",
    body: { kind: "react", render: () => <Text>Destination page</Text> },
  });
  workbench.views.registerView({
    id: "suspended",
    title: "Suspended",
    body: {
      kind: "react",
      render: (input) => (
        <Activity mode={input.visible ? "visible" : "hidden"}>
          <UiScopeActivity active>
            <OverlayControls workbench={workbench} label="Suspended" destination="two" />
          </UiScopeActivity>
        </Activity>
      ),
    },
  });
  const pageViews: Record<string, string> = { one: "main", suspended: "suspended" };
  for (const id of ["one", "two", "other", "suspended"]) {
    workbench.pages.registerPage({
      id,
      ref: pageRef(id),
      path: id,
      modeId: id === "other" ? "other" : "first",
      main: { kind: "view", view: { kind: "view", id: pageViews[id] ?? "destination" }, cardinality: "one" },
      slots: [],
    });
  }
  workbench.pageLocations.switchProject("overlay-navigation");
  void workbench.navigation.openTarget({ kind: "page", page: pageRef("one") });
  return workbench;
};

const OverlayNavigation = () => {
  const [workbench] = useState(createOverlayWorkbench);
  return (
    <WorkbenchThemeProvider>
      <Stack h="100dvh" gap="0">
        <HStack p="sm">
          {["one", "two", "other", "suspended"].map((id) => (
            <Button key={id} onClick={() => void workbench.navigation.openTarget({ kind: "page", page: pageRef(id) })}>
              Page {id}
            </Button>
          ))}
        </HStack>
        <Workbench workbench={workbench} />
      </Stack>
    </WorkbenchThemeProvider>
  );
};

export default {
  title: "Product/Workbench/Navigation/Overlay dismissal",
  component: OverlayNavigation,
  fullscreen: true,
  description:
    "Navigate from an open popover, or press N on a focused help trigger. Returning preserves drafts and leaves overlays closed.",
} satisfies CanvasMeta<typeof OverlayNavigation>;

export const Navigation: CanvasFrame<typeof OverlayNavigation> = {};
