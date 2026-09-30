import { Box, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { FileText, MousePointer2, X } from "lucide-react";
import type { SceneProps } from "motion-lab/kit";
import { duration, PanelSurface, progress, timings, track, WorkbenchFrame } from "motion-lab/kit";

const names = ["README.md", "motion.ts", "chat.tsx", "panels.tsx", "notes.md"];
const closeTimes = [Infinity, 1, 1.5, 2, Infinity];
const StudyTab = (props: { name: string; width: number; selected: boolean }) => {
  const { name, width, selected } = props;
  const styles = useSlotRecipe({ key: "tabs" })({ size: "sm" });
  return (
    <HStack
      css={[styles.root, styles.trigger]}
      data-selected={selected ? "" : undefined}
      w={`${width}px`}
      minW="48px"
      gap="2xs"
      flexShrink="0"
      title={name}
      aria-label={name}
    >
      <Box flexShrink="0">
        <FileText size={14} />
      </Box>
      <HStack gap="0" minW="0" flex="1" overflow="hidden">
        <Text textStyle="label/S/regular" truncate>
          {name.slice(0, -4)}
        </Text>
        <Text textStyle="label/S/regular" flexShrink="0">
          {name.slice(-4)}
        </Text>
      </HStack>
      <Box flexShrink="0">
        <X size={12} />
      </Box>
    </HStack>
  );
};

export const Tabs = (props: SceneProps) => {
  const { time } = props;
  const crowded = time >= 4;
  const width = track(time, [{ at: 4, value: 96, duration: duration(props, timings.tabClose, true) }], 160);
  const tabs = crowded ? Array.from({ length: 25 }, (_, i) => `file-${i + 1}.ts`) : names;
  return (
    <WorkbenchFrame>
      <PanelSurface
        header={
          <Box position="relative" w="full" minW="0">
            <HStack gap="0" w="full" overflowX="auto" overflowY="hidden">
              {tabs.map((name, index) => {
                const closed = crowded ? 0 : progress(time, closeTimes[index], duration(props, timings.tabClose, true));
                return (
                  <Box
                    key={name}
                    w={`${((crowded ? width : 160) + 4) * (1 - closed)}px`}
                    overflow="hidden"
                    flexShrink="0"
                  >
                    <StudyTab name={name} width={crowded ? width : 160} selected={index === 0} />
                  </Box>
                );
              })}
            </HStack>
            {!crowded && time >= 0.8 && time < 3 && (
              <Box position="absolute" top="sm" left="309px">
                <MousePointer2 size={18} />
              </Box>
            )}
          </Box>
        }
      >
        <Stack p="lg" gap="md">
          <Text textStyle="heading/M">Motion studies</Text>
          <Text textStyle="paragraph/S/regular">Review chat and workbench motion using the shared UI components.</Text>
        </Stack>
      </PanelSurface>
    </WorkbenchFrame>
  );
};

export default Tabs;
