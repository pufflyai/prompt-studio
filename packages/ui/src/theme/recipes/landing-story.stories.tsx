import { Box, Icon, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { createGlyphIcon } from "@/components/primitives/glyph-icon";

const ExampleIcon = createGlyphIcon("cloud-add");

const LandingStory = () => {
  const styles = useSlotRecipe({ key: "landingStory" })({});
  return (
    <Box css={styles.page}>
      <Box css={styles.section}>
        <Stack css={styles.intro}>
          <Text as="h1" textStyle="heading/L">
            Extend Prompt Studio by combining building blocks.
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            Choose the pieces your tool needs.
          </Text>
        </Stack>
        <Box css={styles.blockGrid}>
          {[
            { name: "Pages", detail: "Give your tool an interface." },
            { name: "Editors", detail: "Work with files your way." },
            { name: "Commands", detail: "Add an action you or your agent can run." },
            { name: "Skills", detail: "Teach your agent how you work." },
            { name: "Hooks", detail: "Run an action when something happens." },
            { name: "Schedules", detail: "Give repeated work a time to run." },
          ].map((block) => (
            <Box key={block.name} css={styles.block}>
              <Text as="h2" textStyle="heading/S">
                {block.name}
              </Text>
              <Text textStyle="paragraph/M/regular">{block.detail}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      <Box css={styles.section}>
        <Stack css={styles.intro}>
          <Text as="h2" textStyle="heading/L">
            A clean editor out of the box
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            Give your tools a consistent UI, with panels, navigation, and themes included.
          </Text>
        </Stack>
        <Box css={styles.visual}>
          <Box css={styles.panels}>
            {["Your icon set", "Icon inspector"].map((title) => (
              <Box css={styles.panel} key={title}>
                <Box css={styles.panelHeader}>
                  <Text>{title}</Text>
                </Box>
                <Box css={styles.panelBody}>
                  <Icon as={ExampleIcon} boxSize="16" />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
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
