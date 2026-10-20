import { Input, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { WorkbenchStory } from "../../examples/workbench-story";
import { opening, ref, setup } from "../resource-links/related-resource-openings.fixture";

const createResetWorkbench = () => {
  const { workbench: w } = setup([opening("Related document")], {
    initialSidePanelMode: "attached",
    defaultPanelOpenByRegionId: { secondary: true },
  });
  w.views.registerView({
    id: "draft-editor",
    title: "Draft",
    body: {
      kind: "react",
      render: () => (
        <Stack p="md" gap="sm">
          <Text>Moved resource</Text>
          <Input aria-label="Retained draft" />
        </Stack>
      ),
    },
  });
  w.shellPlacements.registerPlacement({
    id: "manual",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "draft-editor" },
        kinds: [{ kind: "resource-kind", id: "session" }],
        cardinality: "many",
      },
    },
  });
  w.shellPlacements.openPlacement({
    placementId: "manual",
    resource: { ...ref("session", "draft"), label: "Draft" },
    open: "pin",
  });
  w.movePanel(w.layout.getActivePanel("side")!.instanceId, "main");
  w.layout.setRegionSize("side", 480);
  w.shell.setHeaderVisible("side", false);
  return w;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel reset",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;

const verifyReset: Story["play"] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  const input = await canvas.findByRole("textbox", { name: "Retained draft" });
  await userEvent.type(input, "Unsaved work");
  const before = args.workbench.layout.getLayout();
  await userEvent.pointer({ target: canvas.getByRole("tab", { name: "Draft" }), keys: "[MouseRight]" });
  await expect(body.getByRole("menuitem", { name: "Reset page choices" })).toBeVisible();
  await expect(body.getByRole("menuitem", { name: "Reset panel layout" })).toBeVisible();
  const reset = canvasElement.dataset.reset === "panels" ? "Reset panel layout" : "Reset page choices";
  await userEvent.click(body.getByRole("menuitem", { name: reset }));
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Unsaved work");
  await expect(canvas.getByRole("textbox", { name: "Retained draft" })).toBe(input);
  const after = args.workbench.layout.getLayout();
  await expect(after.regions.main.widgets).toEqual(before.regions.main.widgets);
  if (reset === "Reset panel layout") {
    await expect(after.regions.side.size).toBeUndefined();
    await expect(after.regions.side.headerVisible).toBeUndefined();
  } else await expect(after).toBe(before);
};

export const PageChoices: Story = {
  args: { workbench: createResetWorkbench() },
  play: verifyReset,
};
export const PanelLayout: Story = {
  args: { workbench: createResetWorkbench() },
  play: async (context) => {
    context.canvasElement.dataset.reset = "panels";
    await verifyReset?.(context);
  },
};
