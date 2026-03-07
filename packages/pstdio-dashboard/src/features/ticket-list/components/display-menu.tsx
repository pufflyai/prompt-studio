import {
  Box,
  Button,
  createListCollection,
  HStack,
  Popover,
  Portal,
  SegmentGroup,
  Select,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { KanbanSquare, List, Settings2 } from "lucide-react";

import type { DisplayProperty, DisplaySettings, GroupingField, OrderingField, ViewMode } from "../types";

interface DisplayMenuProps {
  settings: DisplaySettings;
  onSettingsChange: (next: DisplaySettings) => void;
}

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "board", label: "Board", icon: KanbanSquare },
];

const GROUPING_OPTIONS: { value: GroupingField; label: string }[] = [
  { value: "status", label: "Status" },
  { value: "complexity", label: "Complexity" },
  { value: "assignee", label: "Assignee" },
  { value: "none", label: "No grouping" },
];

const ORDERING_OPTIONS: { value: OrderingField; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
  { value: "complexity", label: "Complexity" },
  { value: "shorthand", label: "ID" },
];

const DISPLAY_PROPERTY_OPTIONS: { value: DisplayProperty; label: string }[] = [
  { value: "parentId", label: "parent_id" },
  { value: "status", label: "Status" },
  { value: "complexity", label: "Complexity" },
  { value: "assignee", label: "Assignee" },
  { value: "tags", label: "Tags" },
  { value: "updatedAt", label: "Updated" },
];

const GROUPING_COLLECTION = createListCollection({ items: GROUPING_OPTIONS });
const ORDERING_COLLECTION = createListCollection({ items: ORDERING_OPTIONS });
const DISPLAY_PROPERTIES_COLLECTION = createListCollection({ items: DISPLAY_PROPERTY_OPTIONS });

const SectionLabel = (props: { children: string }) => (
  <Box>
    <Text textStyle="label/XS/medium" color="fg.muted">
      {props.children}
    </Text>
  </Box>
);

export const DisplayMenu = (props: DisplayMenuProps) => {
  const { settings, onSettingsChange } = props;

  const updateField = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Popover.Root positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm">
          <HStack gap="2xs">
            <Settings2 size={14} />
            <Text textStyle="label/XS/medium">Display</Text>
          </HStack>
        </Button>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content w="320px" p="sm" bg="bg">
            <Stack gap="sm">
              <SectionLabel>View</SectionLabel>

              <SegmentGroup.Root
                size="sm"
                value={settings.viewMode}
                onValueChange={(event) => {
                  if (!event.value) return;
                  updateField("viewMode", event.value as ViewMode);
                }}
              >
                <SegmentGroup.Indicator />
                {VIEW_OPTIONS.map((option) => (
                  <SegmentGroup.Item key={option.value} value={option.value}>
                    <SegmentGroup.ItemText>
                      <HStack as="span" gap="2xs">
                        <option.icon size={14} />
                        <span>{option.label}</span>
                      </HStack>
                    </SegmentGroup.ItemText>
                    <SegmentGroup.ItemHiddenInput />
                  </SegmentGroup.Item>
                ))}
              </SegmentGroup.Root>

              <Separator />
              <Stack gap="xs">
                <Stack gap="2xs">
                  <SectionLabel>Grouping</SectionLabel>
                  <Select.Root
                    collection={GROUPING_COLLECTION}
                    size="sm"
                    value={[settings.grouping]}
                    onValueChange={(event) => {
                      const [value] = event.value;
                      if (!value) return;
                      updateField("grouping", value as GroupingField);
                    }}
                  >
                    <Select.HiddenSelect />
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select grouping" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {GROUPING_COLLECTION.items.map((option) => (
                          <Select.Item item={option} key={option.value}>
                            {option.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Stack>

                <Stack gap="2xs">
                  <SectionLabel>Ordering</SectionLabel>
                  <Select.Root
                    collection={ORDERING_COLLECTION}
                    size="sm"
                    value={[settings.ordering]}
                    onValueChange={(event) => {
                      const [value] = event.value;
                      if (!value) return;
                      updateField("ordering", value as OrderingField);
                    }}
                  >
                    <Select.HiddenSelect />
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select ordering" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Select.Positioner>
                      <Select.Content>
                        {ORDERING_COLLECTION.items.map((option) => (
                          <Select.Item item={option} key={option.value}>
                            {option.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Select.Root>
                </Stack>
              </Stack>

              <Separator />
              <Stack gap="2xs">
                <SectionLabel>Display Properties</SectionLabel>
                <Select.Root
                  multiple
                  collection={DISPLAY_PROPERTIES_COLLECTION}
                  size="sm"
                  value={settings.displayProperties}
                  onValueChange={(event) => {
                    updateField("displayProperties", event.value as DisplayProperty[]);
                  }}
                >
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select display properties" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Select.Positioner>
                    <Select.Content>
                      {DISPLAY_PROPERTIES_COLLECTION.items.map((option) => (
                        <Select.Item item={option} key={option.value}>
                          {option.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Select.Root>
              </Stack>
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
