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
import { useTranslation } from "react-i18next";

import type { DisplayProperty, DisplaySettings, GroupingField, OrderingField, ViewMode } from "../types";

interface DisplayMenuProps {
  settings: DisplaySettings;
  onSettingsChange: (next: DisplaySettings) => void;
}

const SectionLabel = (props: { children: string }) => (
  <Box>
    <Text textStyle="label/XS/medium" color="fg.muted">
      {props.children}
    </Text>
  </Box>
);

export const DisplayMenu = (props: DisplayMenuProps) => {
  const { settings, onSettingsChange } = props;
  const { t } = useTranslation("tickets");

  const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof List }[] = [
    { value: "list", label: t("displayMenu.list"), icon: List },
    { value: "board", label: t("displayMenu.board"), icon: KanbanSquare },
  ];

  const GROUPING_OPTIONS: { value: GroupingField; label: string }[] = [
    { value: "status", label: t("displayMenu.groupingOptions.status") },
    { value: "complexity", label: t("displayMenu.groupingOptions.complexity") },
    { value: "assignee", label: t("displayMenu.groupingOptions.assignee") },
    { value: "none", label: t("displayMenu.groupingOptions.none") },
  ];

  const ORDERING_OPTIONS: { value: OrderingField; label: string }[] = [
    { value: "manual", label: t("displayMenu.orderingOptions.manual") },
    { value: "updated", label: t("displayMenu.orderingOptions.updated") },
    { value: "title", label: t("displayMenu.orderingOptions.title") },
    { value: "complexity", label: t("displayMenu.orderingOptions.complexity") },
    { value: "shorthand", label: t("displayMenu.orderingOptions.shorthand") },
  ];

  const DISPLAY_PROPERTY_OPTIONS: { value: DisplayProperty; label: string }[] = [
    { value: "parentId", label: t("displayMenu.propertyOptions.parentId") },
    { value: "status", label: t("displayMenu.propertyOptions.status") },
    { value: "complexity", label: t("displayMenu.propertyOptions.complexity") },
    { value: "assignee", label: t("displayMenu.propertyOptions.assignee") },
    { value: "tags", label: t("displayMenu.propertyOptions.tags") },
    { value: "updatedAt", label: t("displayMenu.propertyOptions.updatedAt") },
  ];

  const GROUPING_COLLECTION = createListCollection({ items: GROUPING_OPTIONS });
  const ORDERING_COLLECTION = createListCollection({ items: ORDERING_OPTIONS });
  const DISPLAY_PROPERTIES_COLLECTION = createListCollection({ items: DISPLAY_PROPERTY_OPTIONS });

  const updateField = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Popover.Root positioning={{ placement: "bottom-end", offset: { mainAxis: 8 } }}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="sm">
          <HStack gap="2xs">
            <Settings2 size={14} />
            <Text textStyle="label/XS/medium">{t("displayMenu.display")}</Text>
          </HStack>
        </Button>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner>
          <Popover.Content w="320px" p="sm" bg="bg">
            <Stack gap="sm">
              <SectionLabel>{t("displayMenu.view")}</SectionLabel>

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
                  <SectionLabel>{t("displayMenu.grouping")}</SectionLabel>
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
                        <Select.ValueText placeholder={t("displayMenu.selectGrouping")} />
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
                  <SectionLabel>{t("displayMenu.ordering")}</SectionLabel>
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
                        <Select.ValueText placeholder={t("displayMenu.selectOrdering")} />
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
                <SectionLabel>{t("displayMenu.displayProperties")}</SectionLabel>
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
                      <Select.ValueText placeholder={t("displayMenu.selectDisplayProperties")} />
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
