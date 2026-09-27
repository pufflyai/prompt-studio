import { Box, Button, HStack, Input, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { Header } from "@pstdio/ui";
import { Copy, FileText, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import type { SceneProps } from "../model";
import { duration, track } from "../motion";
import { timings, tooltipDelaySeconds } from "../presets";
import { FileRow, SceneWindow } from "../scene-ui";

export const Surfaces = (props: SceneProps) => {
  const { time, reducedMotion } = props;
  const menuStyles = useSlotRecipe({ key: "menu" })();
  const dialogStyles = useSlotRecipe({ key: "dialog" })();
  const tooltipStyles = useSlotRecipe({ key: "tooltip" })();
  const menu = track(time, [
    { at: 1, value: 1, duration: duration(props, timings.surfaceEnter) },
    { at: 2.5, value: 0, duration: duration(props, timings.surfaceExit) },
  ]);
  const tooltip = track(time, [
    { at: 3 + tooltipDelaySeconds, value: 1, duration: duration(props, timings.surfaceEnter) },
    { at: 4.5, value: 0, duration: duration(props, timings.surfaceExit) },
  ]);
  const dialog = track(time, [
    { at: 5, value: 1, duration: duration(props, timings.dialogEnter) },
    { at: 9, value: 0, duration: duration(props, timings.dialogExit) },
    { at: 10, value: 1, duration: duration(props, timings.dialogEnter) },
    { at: 10.07, value: 0, duration: duration(props, timings.dialogExit) },
  ]);
  return (
    <SceneWindow title="Workspace / Resources" sidebar>
      <Stack p="lg" gap="md">
        <HStack>
          <Text textStyle="heading/M" flex="1">
            Project files
          </Text>
          <Button size="sm" variant="ghost">
            <MoreHorizontal size={16} />
          </Button>
        </HStack>
        <FileRow name="README.md" />
        <FileRow name="notes.md" />
        <Box
          position="absolute"
          top="16"
          right="lg"
          css={menuStyles.content}
          opacity={menu}
          transform={`translateY(${reducedMotion ? 0 : 4 * (1 - menu)}px)`}
        >
          {[
            [Pencil, "Rename"],
            [Copy, "Copy path"],
            [Trash2, "Delete"],
          ].map(([Icon, label]) => {
            const Glyph = Icon as typeof Pencil;
            return (
              <HStack key={String(label)} css={menuStyles.item}>
                <Glyph size={14} />
                <Text flex="1">{String(label)}</Text>
              </HStack>
            );
          })}
        </Box>
        <HStack mt="lg">
          <Button size="sm" variant="outline">
            <FileText size={16} />
            Open file
          </Button>
          <Box
            css={tooltipStyles.content}
            position="relative"
            opacity={tooltip}
            transform={`translateY(${reducedMotion ? 0 : 4 * (1 - tooltip)}px)`}
          >
            Open the selected file
          </Box>
        </HStack>
      </Stack>
      {dialog > 0 && (
        <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center">
          <Box position="absolute" inset="0" bg="blackAlpha.600" opacity={dialog} />
          <Box
            css={dialogStyles.content}
            w="lg"
            maxW="90%"
            position="relative"
            opacity={dialog}
            transform={`translateY(${reducedMotion ? 0 : 6 * (1 - dialog)}px)`}
          >
            <Header px="md">
              <Text textStyle="heading/dialog" flex="1">
                Rename file
              </Text>
              <X size={14} />
            </Header>
            <Stack p="md" gap="md">
              <Text textStyle="label/S/regular">File name</Text>
              <Input size="sm" readOnly value={time < 7 ? "README.md" : "motion-notes.md"} />
              <HStack justify="end">
                <Button size="sm">Cancel</Button>
                <Button size="sm" variant="primary">
                  Rename
                </Button>
              </HStack>
            </Stack>
          </Box>
        </Box>
      )}
    </SceneWindow>
  );
};
