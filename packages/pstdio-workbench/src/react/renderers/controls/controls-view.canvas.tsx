import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ControlValueMap } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { WorkbenchControlsView } from "./controls-view";

function ApplyControlsPreview() {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    let saved: ControlValueMap = { name: "Saved value" };
    renderers.registerControlsRenderer({
      id: "settings",
      title: "Settings",
      executeQuery: () => ({
        params: [{ id: "name", type: "text", name: "Name", singleLine: true, defaultValue: "" }],
        values: saved,
      }),
      apply: async ({ values }) => {
        if (values.name === "invalid") throw new Error("Choose a valid name.");
        saved = { ...values };
      },
    });
    return { workbench, renderers, contribution: renderers.getControlsRenderer("settings")! };
  });
  return (
    <Stack h="full" minH="0">
      <Button onClick={() => fixture.renderers.refreshControlsRenderer("settings")}>Refresh saved values</Button>
      <WorkbenchControlsView
        workbench={fixture.workbench}
        contribution={fixture.contribution}
        placement={{ instanceId: "settings", panelId: "settings", title: "Settings", closable: false }}
      />
    </Stack>
  );
}
const meta: CanvasMeta<typeof ApplyControlsPreview> = {
  title: "Workbench/Controls/Apply drafts",
  component: ApplyControlsPreview,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
};
export default meta;
type Story = CanvasFrame<typeof ApplyControlsPreview>;
export const ApplyResetAndRefresh: Story = {
  id: "workbench-controls-apply-drafts--apply-reset-and-refresh",
};
function ImmediateControlsPreview() {
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const renderers = getWorkbenchRenderers(workbench);
    let saved: ControlValueMap = {};
    renderers.registerControlsRenderer({
      id: "instant",
      title: "Immediate choices",
      executeQuery: () => ({
        params: ["first", "second"].map((id) => ({
          id,
          type: "text" as const,
          name: id,
          singleLine: true,
          defaultValue: "",
        })),
        values: saved,
      }),
      updateValue: async ({ values }) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        saved = { ...values };
        renderers.refreshControlsRenderer("instant");
      },
    });
    return { workbench, contribution: renderers.getControlsRenderer("instant")! };
  });
  return (
    <WorkbenchControlsView
      workbench={fixture.workbench}
      contribution={fixture.contribution}
      placement={{ instanceId: "instant", panelId: "instant", title: "Immediate choices", closable: false }}
    />
  );
}
export const ImmediateChanges: Story = {
  id: "workbench-controls-apply-drafts--immediate-changes",
  render: () => <ImmediateControlsPreview />,
};
