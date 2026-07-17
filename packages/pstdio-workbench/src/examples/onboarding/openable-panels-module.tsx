import { Stack, Text } from "@chakra-ui/react";
import type { ResourceRef, WorkbenchModuleContribution } from "../../core";

const RENDERER_ID = "onboarding.openable-panels.renderer";
const PRIMARY_WIDGET_ID = "onboarding.openable-panels.workspace";

const workspace: ResourceRef = {
  kind: "workspace",
  uri: "pstdio://onboarding/workspace",
  label: "Example workspace",
};

const panels = [
  { id: "onboarding.openable-panels.output", title: "Output", resourceKinds: ["workspace"] },
  { id: "onboarding.openable-panels.problems", title: "Problems", resourceKinds: ["workspace"] },
  { id: "onboarding.openable-panels.notes", title: "Notes" },
];

export const createOpenablePanelsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.openable-panels",
  activate(ctx) {
    ctx.renderers.registerRenderer({
      id: RENDERER_ID,
      render: ({ placement }) => (
        <Stack h="full" minH="0" p="md" gap="xs">
          <Text textStyle="label/M/semibold">{placement.title}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Right-click this tab to move it left or right. Use the plus menu to add another panel.
          </Text>
        </Stack>
      ),
    });

    ctx.layout.registerWidget({
      id: PRIMARY_WIDGET_ID,
      title: "Workspace",
      area: "main",
      rendererId: RENDERER_ID,
    });
    ctx.layout.openWidget(PRIMARY_WIDGET_ID, { resource: workspace, pinned: true });

    for (const panel of panels) {
      ctx.layout.registerWidget({
        ...panel,
        area: "secondary",
        rendererId: RENDERER_ID,
        openable: true,
        singleton: false,
        reuse: "none",
      });
    }

    ctx.layout.openWidget("onboarding.openable-panels.output", { resource: workspace });
    ctx.layout.openWidget("onboarding.openable-panels.problems", { resource: workspace });
  },
});
