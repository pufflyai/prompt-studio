import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

export const createDropFeedbackWorkbench = (pinned = false, floating = false) => {
  const page = { kind: "page", extensionId: "storybook", id: "drop-feedback" } as const;
  const workbench = createWorkbench({
    startPage: page,
    initialSidePanelMode: floating ? "floating" : "attached",
    defaultPanelOpenByRegionId: { side: true, secondary: true },
  });
  workbench.modes.registerMode({ id: "drop-feedback", label: "Drop feedback", activate() {} });
  workbench.views.registerView({
    id: "document",
    title: "Document",
    body: {
      kind: "react",
      render: (input) => (
        <Box p="md">
          <Text>{input.instance.resource?.label ?? "Open related resources"}</Text>
        </Box>
      ),
    },
  });
  workbench.pages.registerPage({
    id: page.id,
    ref: page,
    modeId: "drop-feedback",
    path: "drop-feedback",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.switchProject("drop-feedback");
  for (const region of ["side", "secondary"] as const) {
    workbench.shellPlacements.registerPlacement({
      id: region,
      region,
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "document" }],
          view: { kind: "view", id: "document" },
          cardinality: "many",
        },
      },
    });
  }
  for (const [id, label, placementId, open] of [
    ["notes", "Implementation notes", "side", "pin"],
    ["latest", "Latest session", "side", "preview"],
    ["incoming", "Incoming session", "secondary", pinned ? "pin" : "preview"],
  ] as const) {
    workbench.shellPlacements.openPlacement({
      placementId,
      resource: { type: "document", id, label, projectId: "drop-feedback", extensionId: "storybook" },
      open,
    });
  }
  return workbench;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Drop feedback",
  component: WorkbenchStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkbenchStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Replacement: Story = { args: { workbench: createDropFeedbackWorkbench() } };
export const DarkReplacement: Story = {
  args: { workbench: createDropFeedbackWorkbench(), initialThemePreference: "pstdio-dark" },
};
export const PinnedInsertion: Story = { args: { workbench: createDropFeedbackWorkbench(true) } };
export const FloatingReplacement: Story = { args: { workbench: createDropFeedbackWorkbench(false, true) } };
