import { Box, HStack, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { useState } from "react";
import { SelectionMenu } from "@/components/param-editor/inputs/selection-menu";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { dashboardRecipe } from "@/theme/recipes/dashboard";
import { exampleSources, initialWidgets } from "./dashboard-fixtures";
import { compactWidgets } from "./dashboard-layout";
import { DashboardRenderer } from "./dashboard-renderer";
import type { DashboardDefinition } from "./dashboard-types";

export function DashboardExample() {
  const styles = useSlotRecipe({ recipe: dashboardRecipe })();
  const [size, setSize] = useState("desktop");
  const [behavior, setBehavior] = useState("editable");
  const behaviors = [
    { id: "editable", name: "Editable" },
    { id: "readonly", name: "Read only" },
    { id: "failure", name: "Save failure" },
  ];
  const [value, setValue] = useState<DashboardDefinition>(() => ({
    widgets: compactWidgets(initialWidgets),
    mode: "vertical",
  }));
  const [days, setDays] = useState(7);
  const periods = [
    { id: "7", name: "Last 7 days" },
    { id: "3", name: "Last 3 days" },
  ];
  return (
    <Stack gap="md" p="md" minW="0">
      <HStack justify="space-between" flexWrap="wrap" gap="sm">
        <SelectionMenu
          triggerAriaLabel="Example behavior"
          triggerLabel={behaviors.find(({ id }) => id === behavior)?.name}
          options={behaviors}
          selectedIds={[behavior]}
          multiSelect={false}
          onToggle={setBehavior}
        />
        <Text textStyle="label/S/medium">Preview size</Text>
        <SegmentedControl
          aria-label="Preview size"
          value={size}
          onValueChange={setSize}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "tablet", label: "Tablet" },
            { value: "phone", label: "Phone" },
          ]}
        />
      </HStack>
      <Box css={styles.preview} data-size={size} borderWidth="1px" borderColor="border.subtle">
        <DashboardRenderer
          value={value}
          onChange={
            behavior === "readonly"
              ? undefined
              : async (next) => {
                  if (behavior === "failure") throw new Error("The example could not save. Choose Editable to retry.");
                  setValue(next);
                }
          }
          sources={exampleSources(days)}
          actions={
            <SelectionMenu
              triggerAriaLabel="Date range"
              triggerLabel={periods.find(({ id }) => id === String(days))?.name}
              options={periods}
              selectedIds={[String(days)]}
              multiSelect={false}
              onToggle={(value) => setDays(Number(value))}
            />
          }
        />
      </Box>
    </Stack>
  );
}
