import { Box, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

const LandingStory = () => {
  const recipe = useSlotRecipe({ key: "landingStory" });
  const styles = recipe({});
  const [selected, setSelected] = useState("Pages");
  return (
    <Box css={styles.page}>
      <Box css={styles.section}>
        <Stack css={styles.intro}>
          <Text as="h1" textStyle="heading/L">
            What will you build?
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            Combine building blocks in your own workbench.
          </Text>
        </Stack>
        <Box css={styles.visual}>
          <Box css={styles.visualHeader}>
            <Text>Font editor</Text>
            <Text>Interactive example</Text>
          </Box>
          <Box css={styles.panels}>
            {["Type specimen", "Glyph editor"].map((title, index) => (
              <Box css={styles.panel} key={title} data-highlighted={selected === ["Pages", "Editors"][index]}>
                <Box css={styles.panelHeader}>
                  <Text>{title}</Text>
                </Box>
                <Box css={styles.panelBody}>
                  <Text textStyle="heading/display/L">Aa</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Box css={styles.blockGrid}>
        {["Pages", "Editors", "Commands", "Skills", "Hooks", "Schedules"].map((name) => (
          <Box
            as="button"
            key={name}
            css={styles.block}
            aria-pressed={selected === name}
            onClick={() => setSelected(name)}
          >
            <Text textStyle="heading/S">{name}</Text>
            <Text textStyle="paragraph/M/regular">A building block for your tools.</Text>
          </Box>
        ))}
      </Box>
      <HStack css={styles.composition}>
        <Text aria-live="polite">Selected: {selected}</Text>
      </HStack>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Story",
  component: LandingStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof LandingStory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Desktop: Story = {};
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
