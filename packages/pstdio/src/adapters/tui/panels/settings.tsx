import { Box, Text } from "ink";

import type { SettingsSection, SettingsStatus, SettingsTag } from "../hooks/use-settings";
import { ColorPicker } from "./color-picker";

interface SettingsProps {
  section: SettingsSection;
  statuses: SettingsStatus[];
  tags: SettingsTag[];
  selectedIndex: number;
  width: number;
  viewportHeight: number;
  colorPickerActive: boolean;
  colorPickerIndex: number;
  createStep: "idle" | "name" | "color";
}

const SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: "statuses", label: "Statuses" },
  { key: "tags", label: "Tags" },
];

export function Settings({
  section,
  statuses,
  tags,
  selectedIndex,
  width,
  viewportHeight,
  colorPickerActive,
  colorPickerIndex,
  createStep,
}: SettingsProps) {
  const sectionBar = SECTIONS.map((s) => {
    const active = s.key === section;
    return (
      <Text key={s.key}>
        <Text bold={active} color={active ? "cyan" : undefined}>
          {active ? " ▸ " : "   "}
          {s.label}
        </Text>
      </Text>
    );
  });

  const items = section === "statuses" ? statuses : tags;
  const isStatuses = section === "statuses";

  const listHeight = Math.max(1, viewportHeight - 3 - (colorPickerActive ? 4 : 0));

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box>
        <Text bold> Settings │</Text>
        {sectionBar}
      </Box>

      <Text dimColor>{"─".repeat(width)}</Text>

      {items.length === 0 ? (
        <Box paddingLeft={2} height={listHeight}>
          <Text dimColor>No {section} found.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" height={listHeight} overflow="hidden">
          {(items as (SettingsStatus | SettingsTag)[]).map((item, i) => {
            const isSelected = i === selectedIndex;
            const isDefault = isStatuses && (item as SettingsStatus).is_default;

            return (
              <Text key={item.id}>
                <Text color={isSelected ? "blue" : undefined}>{isSelected ? " ❯ " : "   "}</Text>
                <Text bold={isSelected}>{item.name.padEnd(14)}</Text>
                <Text color={item.color}>{item.color.padEnd(8)}</Text>
                {isDefault && <Text color="green">*</Text>}
              </Text>
            );
          })}
        </Box>
      )}

      {colorPickerActive && createStep !== "name" && <ColorPicker selectedIndex={colorPickerIndex} width={width} />}

      <Box flexGrow={1} />

      <Box paddingLeft={1}>
        <Text dimColor>
          {createStep === "name" && "type name · enter confirm · esc cancel"}
          {createStep === "color" && "arrows select · enter confirm · esc cancel"}
          {createStep === "idle" &&
            (isStatuses
              ? "n new · c color · d default · x delete · esc back"
              : "n new · c color · x delete · esc back")}
        </Text>
      </Box>
    </Box>
  );
}
