import { Button, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useId, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RegionTabMenu } from "./region-tab-menu";
import { useTabContextMenu } from "./use-tab-context-menu";

const StaticTabActions = () => {
  const triggerId = useId();
  const { menu, show } = useTabContextMenu(triggerId);
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
      <Button id={triggerId} onClick={(event) => show(event.currentTarget)}>
        Tool actions
      </Button>
      <Text role="status">{placement.tabRetention}</Text>
      <RegionTabMenu menu={menu} label="Tool" groups={[]} placement={placement} workbench={workbench} />
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Static tab actions",
  component: StaticTabActions,
  tags: ["!manifest"],
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof StaticTabActions>;
export default meta;

export const PinAndUnpin: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await userEvent.click(canvas.getByRole("button", { name: "Tool actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Unpin tab" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("preview");
    await userEvent.click(canvas.getByRole("button", { name: "Tool actions" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Pin tab" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("persistent");
  },
};
