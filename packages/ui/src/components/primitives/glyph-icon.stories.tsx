import { Box, Button, Grid, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

import { getIconComponent } from "./icon-options";

type StoryFn = () => ReactNode;

/**
 * Glyphs from the repo's own `prompt-studio-icons` font, for the marks lucide does
 * not cover. They resolve through `getIconComponent` exactly like a lucide icon, so
 * call sites size them with `boxSize` and tint them with `color`.
 *
 * Add or change a glyph with the font-editor extension (`pst font-editor glyph add`),
 * which regenerates the font and its stylesheet; the stylesheet stays the source of
 * truth for codepoints. `@pstdio/ui` declares the `@font-face` itself with woff2 only.
 */
const meta = {
  title: "Foundations/Icons/Prompt Studio Glyphs",
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

const STATUS_GLYPHS = [
  { name: "status-backlog", use: "Backlog — dashed ring" },
  { name: "status-todo", use: "Todo — open ring" },
  { name: "status-progress", use: "In progress — half pie" },
  { name: "status-review", use: "In review — three-quarter pie" },
  { name: "status-done", use: "Done — filled, check knocked out" },
  { name: "status-canceled", use: "Canceled — filled, cross knocked out" },
];

const LEVEL_GLYPHS = [
  { name: "level-low", use: "1 of 4 bars" },
  { name: "level-mid", use: "2 of 4 bars" },
  { name: "level-high", use: "3 of 4 bars" },
  { name: "level-xhigh", use: "4 of 4 bars" },
];

const GlyphTable = (props: { entries: { name: string; use: string }[] }) => (
  <Stack gap="none">
    {props.entries.map((entry) => (
      <HStack key={entry.name} gap="sm" py="xs" borderBottomWidth="1px" borderColor="border.subtle">
        <Icon as={getIconComponent(entry.name)} boxSize="icon-sm" color="fg" />
        <Text textStyle="label/S/medium" minWidth="9rem">
          {entry.name}
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {entry.use}
        </Text>
      </HStack>
    ))}
  </Stack>
);

/** Ring marks for the ticket lifecycle, matching `cmp/StatusRing` in the design system. */
export const StatusRings = {
  render: () => <GlyphTable entries={STATUS_GLYPHS} />,
};

/**
 * Level meters for priority and complexity. A font glyph is single-colour, so unfilled
 * bars are outlined rather than tinted, and the marks are trimmed to 82% because a solid
 * square reads heavier than a round glyph at the same ink size.
 */
export const LevelBars = {
  render: () => <GlyphTable entries={LEVEL_GLYPHS} />,
};

/** Glyphs scale with `boxSize` and inherit `color`, exactly like a lucide icon. */
export const SizesAndColor = {
  render: () => (
    <Stack gap="md">
      <HStack gap="md" alignItems="center">
        {["icon-xs", "icon-sm", "icon-md", "2rem", "3rem"].map((size) => (
          <Icon key={size} as={getIconComponent("status-review")} boxSize={size} color="fg" />
        ))}
      </HStack>
      <HStack gap="md" alignItems="center">
        {["fg.muted", "red.500", "orange.500", "green.500", "blue.500", "purple.500"].map((color) => (
          <Icon key={color} as={getIconComponent("status-done")} boxSize="icon-md" color={color} />
        ))}
      </HStack>
    </Stack>
  ),
};

/**
 * Every glyph is normalised to the same ink box by the font builder, so the wrapper
 * re-centres it and matches lucide's optical size. These rows are the regression check:
 * glyphs must sit on the same centre line as the lucide icons beside them.
 */
export const InlineAlignment = {
  render: () => {
    const marks = ["status-todo", "status-done", "level-low", "level-xhigh", "flame", "bug", "tag"];

    return (
      <Stack gap="md" alignItems="flex-start">
        <HStack gap="xs">
          {marks.map((name) => (
            <Button key={name} size="sm" variant="outline">
              <Icon as={getIconComponent(name)} boxSize="icon-xs" />
              {name}
            </Button>
          ))}
        </HStack>
        <Stack gap="2xs">
          {marks.map((name) => (
            <HStack key={name} gap="xs">
              <Icon as={getIconComponent(name)} boxSize="icon-xs" />
              <Text textStyle="paragraph/S/regular">Menu row — {name}</Text>
            </HStack>
          ))}
        </Stack>
        <Text textStyle="paragraph/S/regular">
          Inline with text:{" "}
          {marks.map((name) => (
            <Icon key={name} as={getIconComponent(name)} boxSize="icon-xs" mx="2xs" />
          ))}
          end.
        </Text>
      </Stack>
    );
  },
};

/** The full font, so a new glyph shows up here as soon as it is added. */
export const AllGlyphs = {
  render: () => (
    <Grid templateColumns="repeat(auto-fill, minmax(9rem, 1fr))" gap="sm">
      {[...STATUS_GLYPHS, ...LEVEL_GLYPHS].map((entry) => (
        <HStack key={entry.name} gap="xs">
          <Icon as={getIconComponent(entry.name)} boxSize="icon-sm" color="fg.muted" />
          <Text textStyle="label/2XS" color="fg.subtle">
            {entry.name}
          </Text>
        </HStack>
      ))}
    </Grid>
  ),
};
