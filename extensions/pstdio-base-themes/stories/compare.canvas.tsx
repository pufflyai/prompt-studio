import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { CoreComponents, type Section } from "./core-components.canvas";

function Compare(props: { section: Section }) {
  const { section } = props;
  return (
    <Stack gap="md">
      <Text p="md" textStyle="paragraph/S/regular" color="fg.muted">
        Use Theme in the frame toolbar to compare these components. Each frame keeps its own theme and interaction
        state.
      </Text>
      <CoreComponents section={section} />
    </Stack>
  );
}
const meta = {
  title: "Themes/Compare",
  fullscreen: true,
  component: Compare,
  args: { section: "all" },
} satisfies CanvasMeta<typeof Compare>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const AllCoreComponents: Story = {
  id: "themes-compare--all-core-components",
};
export const SurfacesAndText: Story = {
  id: "themes-compare--surfaces-and-text",
  args: { section: "foundations" },
};
export const ButtonStates: Story = {
  id: "themes-compare--button-states",
  args: { section: "buttons" },
};
export const FormControls: Story = {
  id: "themes-compare--form-controls",
  args: { section: "inputs" },
};
export const NavigationAndLists: Story = {
  id: "themes-compare--navigation-and-lists",
  args: { section: "navigation" },
};
export const DataDisplayAndFeedback: Story = {
  id: "themes-compare--data-display-and-feedback",
  args: { section: "feedback" },
};
export const MenusAndOverlays: Story = {
  id: "themes-compare--menus-and-overlays",
  args: { section: "overlays" },
};
export const ComposedControls: Story = {
  id: "themes-compare--composed-controls",
  args: { section: "composed" },
};
