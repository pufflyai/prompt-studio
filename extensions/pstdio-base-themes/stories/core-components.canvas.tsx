import { Stack } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
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
function CoreComponents(props: { section: Section }) {
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
  component: CoreComponents,
  args: { section: "all" },
  argTypes: { section: { control: "select", options: ["all", ...Object.keys(sections)] } },
} satisfies CanvasMeta<typeof CoreComponents>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Core: Story = {
  id: "themes-single-theme--core",
};
export const InteractionChecks: Story = {
  id: "themes-single-theme--interaction-checks",
  globals: { theme: "solarized-light" },
};
export const SolarizedDarkChecks: Story = {
  id: "themes-single-theme--solarized-dark-checks",
  ...InteractionChecks,
  globals: { theme: "solarized-dark" },
};
export const DraculaChecks: Story = {
  id: "themes-single-theme--dracula-checks",
  ...InteractionChecks,
  globals: { theme: "dracula" },
};
export const MonokaiChecks: Story = {
  id: "themes-single-theme--monokai-checks",
  ...InteractionChecks,
  globals: { theme: "monokai" },
};
