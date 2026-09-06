import { Box, Button, chakra, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../../react";
import { kilnFrameCount, kilnFrameRate, kilnTracks } from "./kiln-animation";
import { kilnObjects, kilnPage, kilnResource } from "./kiln-data";
import { kilnStore } from "./kiln-state";
import { usePrimaryResource, useShowcaseStore } from "./showcase-store";

const ticks = [1, 24, 48, 72, 96, 120];
const framePosition = (frame: number) => `${((frame - 1) / (kilnFrameCount - 1)) * 100}%`;
const seek = (frame: number) => kilnStore.setState({ frame, playing: false });

const KilnPlayback = () => {
  const state = useShowcaseStore(kilnStore);
  useEffect(() => {
    if (!state.playing) return;
    const startFrame = kilnStore.getState().frame;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const elapsedFrames = Math.floor(((performance.now() - startedAt) / 1000) * kilnFrameRate);
      kilnStore.setState({ frame: ((startFrame - 1 + elapsedFrames) % kilnFrameCount) + 1 });
    }, 1000 / kilnFrameRate);
    return () => window.clearInterval(timer);
  }, [state.playing]);

  return (
    <HStack gap="2xs">
      <IconButton aria-label="First frame" size="2xs" variant="ghost" onClick={() => seek(1)}>
        <WorkbenchIcon name="SkipBack" />
      </IconButton>
      <IconButton
        aria-label="Previous frame"
        size="2xs"
        variant="ghost"
        onClick={() => seek(Math.max(1, state.frame - 1))}
      >
        <WorkbenchIcon name="StepBack" />
      </IconButton>
      <IconButton
        aria-label={state.playing ? "Pause animation" : "Play animation"}
        aria-pressed={state.playing}
        size="xs"
        variant="primary"
        onClick={() => kilnStore.setState({ playing: !state.playing })}
      >
        <WorkbenchIcon name={state.playing ? "Pause" : "Play"} />
      </IconButton>
      <IconButton
        aria-label="Next frame"
        size="2xs"
        variant="ghost"
        onClick={() => seek(Math.min(kilnFrameCount, state.frame + 1))}
      >
        <WorkbenchIcon name="StepForward" />
      </IconButton>
      <IconButton aria-label="Last frame" size="2xs" variant="ghost" onClick={() => seek(kilnFrameCount)}>
        <WorkbenchIcon name="SkipForward" />
      </IconButton>
    </HStack>
  );
};

export const KilnTimeline = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const state = useShowcaseStore(kilnStore);
  const selectedId = usePrimaryResource(workbench)?.id;
  const timecode = `${String(Math.floor((state.frame - 1) / kilnFrameRate)).padStart(2, "0")}:${String((state.frame - 1) % kilnFrameRate).padStart(2, "0")}`;

  return (
    <Stack h="full" gap="0" bg="bg.panel" overflow="hidden">
      <HStack px="md" h="10" flexShrink={0} borderBottomWidth="1px" borderColor="border.subtle" justify="space-between">
        <HStack gap="sm">
          <WorkbenchIcon name="Clapperboard" size={14} />
          <Text textStyle="paragraph/XS/semibold">Animation</Text>
          <Text color="fg.muted" textStyle="paragraph/XS/regular">
            5s loop
          </Text>
        </HStack>
        <KilnPlayback />
        <HStack gap="sm" textStyle="paragraph/XS/regular">
          <Text color="fg.muted">{kilnFrameRate} fps</Text>
          <Text fontVariantNumeric="tabular-nums" minW="10">
            {timecode}
          </Text>
        </HStack>
      </HStack>
      <HStack flex="1" minH="0" gap="0" align="stretch">
        <Stack w="44" flexShrink={0} gap="0" borderRightWidth="1px" borderColor="border.subtle">
          <HStack h="8" flexShrink={0} px="md" borderBottomWidth="1px" borderColor="border.subtle">
            <Text color="fg.muted" textStyle="label/XS">
              OBJECT / CHANNEL
            </Text>
          </HStack>
          {kilnTracks.map((track) => {
            const object = kilnObjects.find((item) => item.id === track.objectId)!;
            return (
              <Button
                key={object.id}
                h="9"
                flexShrink={0}
                borderRadius="0"
                size="xs"
                variant={selectedId === object.id ? "subtle" : "ghost"}
                justifyContent="flex-start"
                px="md"
                aria-label={`Select ${object.name} animation`}
                aria-pressed={selectedId === object.id}
                onClick={() =>
                  workbench.pageLocations.navigate({ kind: "page", page: kilnPage, resource: kilnResource(object) })
                }
              >
                <WorkbenchIcon name={object.icon} color={`${object.tint}.300`} size={13} />
                <Text>{object.name}</Text>
                <Text ms="auto" color="fg.muted" textStyle="paragraph/XS/regular">
                  {track.label}
                </Text>
              </Button>
            );
          })}
        </Stack>
        <Box flex="1" minW="0" px="md" overflow="hidden">
          <Box position="relative" h="full">
            {ticks.map((tick) => (
              <Box
                key={tick}
                position="absolute"
                top="0"
                bottom="0"
                left={framePosition(tick)}
                borderLeftWidth="1px"
                borderColor="border.subtle"
                pointerEvents="none"
              />
            ))}
            <Box position="relative" h="8" borderBottomWidth="1px" borderColor="border.subtle">
              {ticks.map((tick) => (
                <Text
                  key={tick}
                  position="absolute"
                  top="xs"
                  left={framePosition(tick)}
                  transform="translateX(-50%)"
                  textStyle="paragraph/XS/regular"
                  color="fg.muted"
                >
                  {tick}
                </Text>
              ))}
              <Input
                aria-label="Animation frame"
                type="range"
                min={1}
                max={kilnFrameCount}
                value={state.frame}
                onChange={(event) => seek(Number(event.target.value))}
                position="absolute"
                inset="0"
                w="full"
                h="full"
                opacity="0"
                cursor="ew-resize"
                _focusVisible={{ opacity: "0.25" }}
              />
            </Box>
            {kilnTracks.map((track) => {
              const object = kilnObjects.find((item) => item.id === track.objectId)!;
              const active = selectedId === object.id;
              return (
                <Box
                  key={object.id}
                  position="relative"
                  h="9"
                  bg={active ? "bg.active" : undefined}
                  borderBottomWidth="1px"
                  borderColor="border.subtle"
                >
                  <Box
                    position="absolute"
                    top="50%"
                    insetStart="0"
                    insetEnd="0"
                    h="1"
                    bg={`${object.tint}.300`}
                    opacity="0.18"
                  />
                  {track.keys.map((key) => (
                    <chakra.button
                      key={key.frame}
                      aria-label={`${object.name} keyframe ${key.frame}`}
                      title={`${track.label}: ${key.value}`}
                      position="absolute"
                      top="50%"
                      left={framePosition(key.frame)}
                      boxSize="2"
                      transform="translate(-50%, -50%) rotate(45deg)"
                      bg={`${object.tint}.300`}
                      borderWidth="1px"
                      borderColor={active ? "fg" : `${object.tint}.300`}
                      cursor="pointer"
                      _hover={{ bg: "fg" }}
                      _focusVisible={{ outline: "2px solid", outlineColor: "border.accent", outlineOffset: "2px" }}
                      onClick={() => {
                        seek(key.frame);
                        workbench.pageLocations.navigate({
                          kind: "page",
                          page: kilnPage,
                          resource: kilnResource(object),
                        });
                      }}
                    />
                  ))}
                </Box>
              );
            })}
            <Box
              position="absolute"
              top="0"
              bottom="0"
              left={framePosition(state.frame)}
              borderLeftWidth="1px"
              borderColor="border.accent"
              pointerEvents="none"
            >
              <Box
                transform="translateX(-50%)"
                bg="bg.accent-primary.default"
                color="fg.button.primary.default"
                px="xs"
                minW="6"
                borderBottomRadius="sm"
                textAlign="center"
                textStyle="paragraph/XS/semibold"
                fontVariantNumeric="tabular-nums"
              >
                {state.frame}
              </Box>
            </Box>
          </Box>
        </Box>
      </HStack>
      <HStack
        h="6"
        px="md"
        justify="space-between"
        borderTopWidth="1px"
        borderColor="border.subtle"
        textStyle="paragraph/XS/regular"
        color="fg.muted"
        flexShrink={0}
      >
        <Text>2 animated objects · 10 keyframes</Text>
        <Text>
          Frame {state.frame} / {kilnFrameCount}
        </Text>
      </HStack>
    </Stack>
  );
};
