import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createPolicyWorkbench } from "./panel-policy.fixture";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Panel policy",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const SharedControls: Story = {
  id: "pstdio-workbench-reference-core-api-panel-policy--shared-controls",
  args: { workbench: createPolicyWorkbench() },
};
export const HiddenHeaders: Story = {
  id: "pstdio-workbench-reference-core-api-panel-policy--hidden-headers",
  args: { workbench: createPolicyWorkbench({ showHeader: false }) },
};
export const RestrictedPanels: Story = {
  id: "pstdio-workbench-reference-core-api-panel-policy--restricted-panels",
  args: {
    workbench: createPolicyWorkbench({
      canOpen: true,
      canClose: false,
      acceptsTabs: false,
      resizable: false,
      floatable: false,
    }),
  },
};
export const LegacyHeaders: Story = {
  id: "pstdio-workbench-reference-core-api-panel-policy--legacy-headers",
  args: { workbench: createPolicyWorkbench({ showHeader: false }, true) },
};
export const FloatingHeader: Story = {
  id: "pstdio-workbench-reference-core-api-panel-policy--floating-header",
  args: {
    workbench: (() => {
      const w = createPolicyWorkbench();
      w.shell.setSidePanelPresentation("floating");
      return w;
    })(),
  },
};
