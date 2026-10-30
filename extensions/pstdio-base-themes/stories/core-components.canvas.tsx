import { Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { Buttons, Inputs } from "./buttons-and-inputs";
import { ComposedComponents } from "./composed-components";
import { Foundations } from "./foundations";
import { DataAndFeedback, Navigation } from "./navigation-and-feedback";
import { Overlays } from "./overlays";

const sections = {
  foundations: Foundations,
  buttons: Buttons,
  inputs: Inputs,
  navigation: Navigation,
  feedback: DataAndFeedback,
  overlays: Overlays,
  composed: ComposedComponents,
};
export type Section = "all" | keyof typeof sections;
export function CoreComponents(props: { section: Section }) {
  const { section } = props;
  const visible = section === "all" ? Object.entries(sections) : ([[section, sections[section]]] as const);
  return (
    <Stack data-testid="theme-canvas" gap="xl" p="md" bg="bg" color="fg" minH="100vh">
      {visible.map(([id, Component]) => (
        <Component key={id} />
      ))}
    </Stack>
  );
}
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
