import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { WorkbenchStory } from "../../examples/workbench-story";
import { createFullscreenWorkbench } from "./fullscreen.fixture";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Main fullscreen",
  component: WorkbenchStory,
  fullscreen: true,
} satisfies CanvasMeta<typeof WorkbenchStory>;
export default meta;
type Story = CanvasFrame<typeof meta>;
const modePolicy = createFullscreenWorkbench();
modePolicy.w.modes.registerMode({ id: "restricted", canFullscreen: false, activate() {} });
export const ModePolicy: Story = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--mode-policy",
  args: { workbench: modePolicy.w },
};
const fullscreenStory = (side: "attached" | "floating" | "closed", floatable = true, hiddenNav = false): Story => {
  const { w } = createFullscreenWorkbench(side, floatable, { hiddenNav });
  return {
    args: { workbench: w },
  };
};
export const AttachedSide = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--attached-side",
  ...fullscreenStory("attached"),
};
export const FloatingSide = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--floating-side",
  ...fullscreenStory("floating"),
};
export const ClosedSide = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--closed-side",
  ...fullscreenStory("closed"),
};
export const FixedSide = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--fixed-side",
  ...fullscreenStory("attached", false),
};
export const HiddenNavigation = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--hidden-navigation",
  ...fullscreenStory("attached", true, true),
};
export const RearrangedPanels = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--rearranged-panels",
  ...fullscreenStory("attached"),
};
RearrangedPanels.args!.workbench!.shell.repositionPanel("side", "left");
RearrangedPanels.args!.workbench!.shell.repositionPanel("secondary", "top");
const navigation = createFullscreenWorkbench();
export const PageAndModeContinuity: Story = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen--page-and-mode-continuity",
  args: { workbench: navigation.w },
};
