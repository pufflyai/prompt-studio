import { Box, Button, HStack, Stack, Text, Textarea, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createGlyphIcon } from "@/components/primitives/glyph-icon";
import { Slider } from "@/components/primitives/slider";

const icons = ["star", "cloud-add", "global", "grid-4", "code", "component"].map((name) => ({
  name,
  icon: createGlyphIcon(name),
}));

const ShaderDemo = (props: { withControls: boolean }) => {
  const { withControls } = props;
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [selected, setSelected] = useState(icons[0]);
  const [scale, setScale] = useState(18);
  const [speed, setSpeed] = useState(0.6);
  return (
    <Box css={story.page}>
      <Box css={styles.prompt}>
        <Text>Add sliders to adjust the scale and speed.</Text>
        <Button variant="subtle" size="lg">
          Try the change
        </Button>
      </Box>
      <Box css={story.panel}>
        <Box css={story.panelHeader}>Your icon set</Box>
        <Box css={story.panelBody}>
          <Box css={styles.iconPicker}>
            {icons.map((item) => (
              <Button
                key={item.name}
                size="2xl"
                variant="ghost"
                aria-label={`Use ${item.name}`}
                aria-pressed={selected.name === item.name}
                onClick={() => setSelected(item)}
              >
                <Box css={styles.tileSymbol}>
                  <item.icon />
                </Box>
              </Button>
            ))}
          </Box>
          <Text textStyle="label/S/regular">Icon set → {selected.name} → Shader preview</Text>
        </Box>
      </Box>
      <Box css={story.panels}>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>waves.frag</Box>
          <Box css={story.panelBody}>
            <Textarea
              css={styles.shaderCode}
              aria-label="Fragment shader code"
              wrap="off"
              spellCheck={false}
              defaultValue={`vec3 shade(vec2 uv) {
  float rings = length(uv - 0.5);
  float wave = sin(
    rings * u_scale - u_time
  );
  vec3 a = vec3(0.10, 0.20, 0.55);
  vec3 b = vec3(0.40, 0.90, 0.85);
  vec3 color = mix(a, b, wave * 0.5 + 0.5);
  float icon = texture2D(u_icon, uv).a;
  return mix(vec3(0.04, 0.06, 0.10), color, icon);
}`}
            />
          </Box>
        </Box>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Preview</Box>
          <Box css={story.panelBody}>
            <Box css={styles.shaderCanvas}>
              <Box height="64" display="grid" placeItems="center" role="img" aria-label="Shader icon preview">
                <Box boxSize="40" fontSize="{sizes.40}" color="fg.info">
                  <selected.icon />
                </Box>
              </Box>
            </Box>
            {withControls && (
              <Stack gap="lg">
                <Stack gap="sm">
                  <HStack css={styles.toolbar} textStyle="label/S/regular">
                    <Text>Scale</Text>
                    <Text>{scale}</Text>
                  </HStack>
                  <Slider
                    aria-label={["Shader scale"]}
                    min={4}
                    max={36}
                    step={1}
                    value={[scale]}
                    onValueChange={({ value }) => setScale(value[0])}
                  />
                </Stack>
                <Stack gap="sm">
                  <HStack css={styles.toolbar} textStyle="label/S/regular">
                    <Text>Speed</Text>
                    <Text>{speed.toFixed(1)}×</Text>
                  </HStack>
                  <Slider
                    aria-label={["Shader speed"]}
                    min={0}
                    max={2}
                    step={0.1}
                    value={[speed]}
                    onValueChange={({ value }) => setSpeed(value[0])}
                  />
                </Stack>
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Shader Demo",
  component: ShaderDemo,
  args: { withControls: false },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShaderDemo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editor: Story = {};
export const WithControls: Story = { args: { withControls: true } };
export const NarrowPanel: Story = {
  args: { withControls: true },
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
