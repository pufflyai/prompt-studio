import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { CoreComponents } from "./core-components";

const meta = {
  title: "Themes/Single theme",
  fullscreen: true,
  component: CoreComponents,
  args: { section: "all" },
} satisfies CanvasMeta<typeof CoreComponents>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Core: Story = {
  id: "themes-single-theme--core",
};
export const InteractionChecks: Story = {
  id: "themes-single-theme--interaction-checks",
};
export const SolarizedDarkChecks: Story = {
  id: "themes-single-theme--solarized-dark-checks",
  ...InteractionChecks,
};
export const DraculaChecks: Story = {
  id: "themes-single-theme--dracula-checks",
  ...InteractionChecks,
};
export const MonokaiChecks: Story = {
  id: "themes-single-theme--monokai-checks",
  ...InteractionChecks,
};
