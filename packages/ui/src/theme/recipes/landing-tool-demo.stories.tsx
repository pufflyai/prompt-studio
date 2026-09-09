import { Box, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createGlyphIcon } from "@/components/primitives/glyph-icon";

const icons = [
  "cloud-add",
  "history",
  "folder",
  "global",
  "notification",
  "grid-4",
  "code",
  "component",
  "magicpen",
].map((name) => ({ name, icon: createGlyphIcon(name) }));

const VisualTool = () => {
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  const story = useSlotRecipe({ key: "landingStory" })({});
  const [selected, setSelected] = useState(icons[0]);
  const [query, setQuery] = useState("");
  return (
    <Box css={story.page}>
      <Box css={styles.iconEditor}>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Your icon set</Box>
          <Stack css={story.panelBody}>
            <Input
              placeholder="Search icons"
              aria-label="Search icons"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Box css={styles.iconGrid}>
              {icons
                .filter((item) => item.name.includes(query.toLowerCase()))
                .map((item) => (
                  <Box
                    as="button"
                    key={item.name}
                    css={styles.iconTile}
                    aria-pressed={item.name === selected.name}
                    onClick={() => setSelected(item)}
                  >
                    <Box css={styles.tileSymbol}>
                      <item.icon />
                    </Box>
                    <Text css={styles.iconName}>{item.name}</Text>
                  </Box>
                ))}
            </Box>
          </Stack>
        </Box>
        <Box css={story.panel}>
          <Box css={story.panelHeader}>Icon inspector</Box>
          <Stack css={story.panelBody}>
            <Box css={styles.inspector}>
              <Box css={styles.iconCanvas} role="img" aria-label={selected.name}>
                <Box css={styles.inspectorSymbol}>
                  <selected.icon />
                </Box>
              </Box>
              <Input value={selected.name} readOnly aria-label="Icon name" />
            </Box>
          </Stack>
        </Box>
      </Box>
      <Box css={styles.metrics}>
        {["Running", "To review", "Completed"].map((label, i) => (
          <Box css={styles.metric} key={label}>
            <Text textStyle="heading/M">{[2, 1, 16][i]}</Text>
            <Text textStyle="label/S/regular">{label}</Text>
          </Box>
        ))}
      </Box>
      <Box css={styles.sessions}>
        {["in_progress", "awaiting_input", "completed"].map((status, index) => (
          <Box css={styles.session} key={status}>
            <HStack css={styles.toolbar}>
              <Text textStyle="label/M/medium">
                {["Add navigation icons", "Refine icon outlines", "Check the icon set"][index]}
              </Text>
              <Text textStyle="label/S/regular">{["Running", "To review", "Completed"][index]}</Text>
            </HStack>
            <Box css={styles.progress} aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <Box key={i} css={styles.segment} data-filled={i < 12} data-status={status} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

const meta = {
  title: "Theme/Landing Tool Demo",
  component: VisualTool,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof VisualTool>;
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
