import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { Section } from "./core-components.canvas";
import { themePreferences } from "./theme-preferences";

const heights: Record<Section, number> = {
  all: 4700,
  foundations: 650,
  buttons: 780,
  inputs: 850,
  navigation: 650,
  feedback: 1050,
  overlays: 650,
  composed: 1100,
};
function Compare(props: { section: Section }) {
  const { section } = props;
  return (
    <Stack p="md" gap="md">
      <Text as="h1" textStyle="heading/M">
        Extra themes — core components
      </Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        The same components and states in every theme. Scroll horizontally on smaller screens. Each column has its own
        document so menus, dialogs and keyboard focus use the real theme.
      </Text>
      <Box overflowX="auto">
        <Grid templateColumns="repeat(4, minmax(22rem, 1fr))" gap="sm">
          {themePreferences.map((theme) => (
            <Stack key={theme.id} gap="xs" minW="0">
              <Text as="h2" textStyle="label/M/medium">
                {theme.title}
              </Text>
              <Box asChild width="full" height={`${heights[section]}px`} borderWidth="1px" borderColor="border">
                <iframe
                  title={theme.title}
                  src={`iframe.html?id=themes-single-theme--core&viewMode=story&globals=theme:${theme.id}&args=section:${section}`}
                />
              </Box>
            </Stack>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
}
const meta = {
  title: "Themes/Compare",
  component: Compare,
  args: { section: "all" },
} satisfies CanvasMeta<typeof Compare>;
export default meta;
type Story = CanvasVariant<typeof meta>;
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
