import { Button, Stack } from "@chakra-ui/react";
import type { ControlValueMap } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createWorkbench, getWorkbenchRenderers } from "../../../core";
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
const meta: Meta<typeof ApplyControlsPreview> = {
  title: "Workbench/Controls/Apply drafts",
  component: ApplyControlsPreview,
};
export default meta;
type Story = StoryObj<typeof ApplyControlsPreview>;
export const ApplyResetAndRefresh: Story = {};
