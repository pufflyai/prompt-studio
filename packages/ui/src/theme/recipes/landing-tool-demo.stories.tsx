import { Box, Button, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createGlyphIcon } from "@/components/primitives/glyph-icon";
import { type SessionCompletionStatus, SessionIndicator } from "@/components/primitives/session-indicator";

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
      <Text textStyle="paragraph/M/regular" color="fg.muted">
        Browse, rename, and organise the icons you use across your tools.
      </Text>
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
        {["Running", "Queued", "Completed"].map((label) => (
          <Box css={styles.metric} key={label}>
            <Text textStyle="heading/M">1</Text>
            <Text textStyle="label/S/regular">{label}</Text>
          </Box>
        ))}
      </Box>
      <Box css={styles.sessions}>
        {(["completed", "in_progress", "queued", "disconnected"] satisfies SessionCompletionStatus[]).map(
          (status, index) => (
            <Box css={styles.session} key={status} data-status={status}>
              <HStack css={styles.toolbar}>
                <Text textStyle="label/M/medium">
                  {["Draw the icons", "Refine the outlines", "Check the icon set", "Paused workflow"][index]}
                </Text>
                <HStack css={styles.sessionStatus} data-status={status}>
                  <SessionIndicator status={status} />
                  <Text textStyle="label/S/regular">{["Completed", "Running", "Queued", "Paused"][index]}</Text>
                </HStack>
              </HStack>
            </Box>
          ),
        )}
      </Box>
      <Box css={styles.prompt}>
        <Text>Add sliders to adjust the scale and speed.</Text>
        <Button variant="subtle" size="lg">
          Try the change
        </Button>
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
const WorkflowPreviewStates = () => {
  const styles = useSlotRecipe({ key: "landingToolDemo" })({});
  return (
    <Box css={styles.iconGrid} p="md">
      {["pending", "active", "ready"].map((state, index) => {
        const Glyph = icons[index].icon;
        return (
          <Box css={styles.iconTile} data-state={state} key={state}>
            <Box css={styles.tileSymbol}>
              <Glyph />
            </Box>
            <Text css={styles.iconName}>{state}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
export const PreviewStates: Story = { render: () => <WorkflowPreviewStates /> };
export const NarrowPanel: Story = {
  decorators: [
    (Story) => (
      <Box width="80">
        <Story />
      </Box>
    ),
  ],
};
