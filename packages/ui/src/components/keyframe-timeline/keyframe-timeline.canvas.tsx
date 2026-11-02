import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { Slider } from "../primitives/slider";

// Design first: grouped property lanes, one shared ruler, and an editable playhead.
const TimelineDesign = () => {
  const [time, setTime] = useState(0.4);
  return (
    <Stack gap="0" borderWidth="1px" borderColor="border.subtle">
      <Flex p="sm" gap="sm" align="center">
        <Text flex="1">Animations · Menu entrance</Text>
        <Button size="xs">Play</Button>
        <Text textStyle="mono/XS">{time.toFixed(2)} / 2.00 s</Text>
      </Flex>
      <Flex gap="md" p="sm">
        <Text w="xs">Tracks</Text>
        <Box flex="1">
          <Slider
            aria-label={["Time"]}
            min={0}
            max={2}
            step={1 / 60}
            value={[time]}
            onValueChange={({ value }) => setTime(value[0])}
          />
        </Box>
      </Flex>
      {[
        ["Bullet 2", "Opacity"],
        ["Bullet 1", "Top"],
        ["Menu", "Left"],
      ].map(([group, property]) => (
        <Stack key={group} gap="0">
          <Text bg="bg.subtle" p="2xs" textStyle="label/S/medium">
            {group}
          </Text>
          <Flex px="sm" gap="md" align="center">
            <Text w="xs">{property}</Text>
            <Flex flex="1" justify="space-between">
              <Button size="xs" variant="ghost" onClick={() => setTime(0)}>
                ◆
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setTime(1)}>
                ◆
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setTime(2)}>
                ◆
              </Button>
            </Flex>
          </Flex>
        </Stack>
      ))}
    </Stack>
  );
};
const meta: CanvasMeta = {
  title: "Components/Media/Keyframe Timeline",
  component: TimelineDesign,
  description:
    "Animation property tracks with shared time, keyframes and grouped lanes. Callers own animation data and playback.",
};
export default meta;
export const Animation: CanvasFrame = { id: "components-media-keyframe-timeline--animation" };
