import { Stack } from "@chakra-ui/react";
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
