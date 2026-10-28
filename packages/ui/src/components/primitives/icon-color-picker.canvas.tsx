import { Box, Grid, Icon, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { IconColorPicker } from "./icon-color-picker";
import { optionIcons } from "./icon-options";
import { TagSwatch } from "./tag-swatch";

type StoryFn = () => ReactNode;
const meta = {
  title: "Components/Inputs/Icon Color Picker",
  component: IconColorPicker,
  decorators: [
    (Story: StoryFn) => (
      <Box padding="lg" background="bg" minHeight="480px">
        <Story />
      </Box>
    ),
  ],
};
export default meta;
export const Default = {
  id: "components-inputs-icon-color-picker--default",
  render: () => {
    const [color, setColor] = useState("red");
    const [icon, setIcon] = useState<string | null>("flame");
    return (
      <Stack gap="sm" alignItems="flex-start">
        <IconColorPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {color} · {icon ?? "none"}
        </Text>
      </Stack>
    );
  },
};
/** Colour-only mode used by the ticket status editor. */
export const ColorOnly = {
  id: "components-inputs-icon-color-picker--color-only",
  render: () => {
    const [color, setColor] = useState("green");
    return <IconColorPicker color={color} showIcons={false} onColorChange={setColor} />;
  },
};
export const PopoverOpen = {
  id: "components-inputs-icon-color-picker--popover-open",
  render: () => {
    const [color, setColor] = useState("blue");
    const [icon, setIcon] = useState<string | null>("status-progress");
    return <IconColorPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />;
  },
};
export const NoIconSentinel = {
  id: "components-inputs-icon-color-picker--no-icon-sentinel",
  render: () => {
    const [color, setColor] = useState("gray");
    const [icon, setIcon] = useState<string | null>("circle");
    return <IconColorPicker color={color} icon={icon} onColorChange={setColor} onIconChange={setIcon} />;
  },
};
/** Every registry entry, including the status ring and level bar font glyphs. */
export const IconRegistry = {
  id: "components-inputs-icon-color-picker--icon-registry",
  render: () => (
    <Grid templateColumns="repeat(8, 1fr)" gap="sm" justifyItems="center" maxWidth="480px">
      {optionIcons.map((entry) => (
        <Stack key={entry.value ?? "none"} gap="2xs" alignItems="center">
          <Icon as={entry.icon} boxSize="icon-md" color="fg.muted" />
          <Text textStyle="label/2XS" color="fg.subtle" textAlign="center">
            {entry.label}
          </Text>
        </Stack>
      ))}
    </Grid>
  ),
};
export const Swatches = {
  id: "components-inputs-icon-color-picker--swatches",
  render: () => (
    <Grid templateColumns="repeat(6, auto)" gap="sm" justifyItems="center" width="fit-content">
      <TagSwatch color="gray" />
      <TagSwatch color="red" icon="flame" />
      <TagSwatch color="yellow" icon="level-mid" />
      <TagSwatch color="blue" icon="status-progress" />
      <TagSwatch color="green" icon="status-done" />
      <TagSwatch color="purple" icon="status-review" />
    </Grid>
  ),
};
