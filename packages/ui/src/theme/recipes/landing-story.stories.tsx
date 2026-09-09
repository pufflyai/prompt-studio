import { Box, Icon, Link, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowRight } from "lucide-react";
import { createGlyphIcon } from "@/components/primitives/glyph-icon";

const ExampleIcon = createGlyphIcon("cloud-add");

const LandingStory = () => {
  const styles = useSlotRecipe({ key: "landingStory" })({ spacing: "spacious" });
  return (
    <Box css={styles.page}>
      <Box css={styles.section}>
        <Stack css={styles.intro}>
          <Text as="h1" textStyle="heading/L">
            Combine building blocks to build extensions.
          </Text>
          <Text textStyle="paragraph/L/regular" color="fg.muted">
            Give your agents the pieces they need to build useful tools.
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
      <Box css={styles.pageNavigation} as="nav" aria-label="Continue exploring">
        <Link href="/examples" variant="underline" color="fg" textStyle="label/M/medium">
          <Text>Next: Examples</Text>
          <Icon as={ArrowRight} boxSize="icon-sm" />
        </Link>
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
