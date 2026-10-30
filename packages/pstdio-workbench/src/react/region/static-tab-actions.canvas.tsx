import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ResourceActionMenu } from "@pstdio/ui";
import { useId, useState } from "react";
import { createWorkbench } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RegionTabMenu } from "./region-tab-menu";
import { useTabContextMenu } from "./use-tab-context-menu";

const StaticTabActions = () => {
  const triggerId = useId();
  const { menu, show, onContextMenu } = useTabContextMenu(triggerId);
  const [created, setCreated] = useState(false);
  const [workbench] = useState(() => {
    const instance = createWorkbench();
    instance.modes.registerMode({ id: "project", activate() {} });
    instance.views.registerView({ id: "tool", title: "Tool", body: { kind: "react", render: () => null } });
    const page = { kind: "page", extensionId: "example", id: "tools" } as const;
    instance.pages.registerPage({
      id: "tools",
      ref: page,
      path: "tools",
      modeId: "project",
      main: { kind: "panels" },
      slots: [
        { id: "tool", region: "main", item: { kind: "view", view: { kind: "view", id: "tool" }, presence: "open" } },
      ],
    });
    instance.pageLocations.setProject("example");
    instance.pageLocations.navigate({ kind: "page", page });
    return instance;
  });
  const placement = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.main.widgets[0]!);
  return (
    <Stack>
      <Button id={triggerId} onClick={(event) => show(event.currentTarget)} onContextMenu={onContextMenu}>
        Tool actions
      </Button>
      <Text role="status">{placement.tabRetention}</Text>
      <ResourceActionMenu actions={[{ key: "new", label: "New tool", onClick: () => setCreated(true) }]}>
        <Button>Add tool</Button>
      </ResourceActionMenu>
      {created ? <Text>Tool created</Text> : null}
      <RegionTabMenu menu={menu} label="Tool" groups={[]} placement={placement} workbench={workbench} />
    </Stack>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Static tab actions",
  component: StaticTabActions,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof StaticTabActions>;
export default meta;
export const PinAndUnpin: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-guides-static-tab-actions--pin-and-unpin",
};
export const AddAfterPin: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-guides-static-tab-actions--add-after-pin",
};
