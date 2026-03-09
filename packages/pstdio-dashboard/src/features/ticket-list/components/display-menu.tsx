import {
  Box,
  Button,
  HStack,
  Icon,
  Menu,
  Popover,
  Portal,
  SegmentGroup,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { MenuItem } from "@pstdio/ui";
import { ChevronDown, KanbanSquare, List, Settings2 } from "lucide-react";
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

  const updateField = <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const selectedGroupingLabel =
    GROUPING_OPTIONS.find((o) => o.value === settings.grouping)?.label ?? t("displayMenu.selectGrouping");

  const selectedOrderingLabel =
    ORDERING_OPTIONS.find((o) => o.value === settings.ordering)?.label ?? t("displayMenu.selectOrdering");

  const displayPropertiesSet = new Set(settings.displayProperties);
  const selectedDisplayPropertiesLabel =
    settings.displayProperties.length > 0
      ? DISPLAY_PROPERTY_OPTIONS.filter((o) => displayPropertiesSet.has(o.value))
          .map((o) => o.label)
          .join(", ")
      : t("displayMenu.selectDisplayProperties");

  const handleDisplayPropertyToggle = (value: DisplayProperty) => {
    const next = displayPropertiesSet.has(value)
      ? settings.displayProperties.filter((p) => p !== value)
      : [...settings.displayProperties, value];
    updateField("displayProperties", next);
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
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button size="sm" variant="outline" width="full" justifyContent="space-between">
                        {selectedGroupingLabel}
                        <Icon as={ChevronDown} color="fg.muted" />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content minW="280px" bg="bg">
                        {GROUPING_OPTIONS.map((option) => (
                          <MenuItem
                            key={option.value}
                            primaryLabel={option.label}
                            isSelected={settings.grouping === option.value}
                            onClick={() => updateField("grouping", option.value)}
                          />
                        ))}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </Stack>

                <Stack gap="2xs">
                  <SectionLabel>{t("displayMenu.ordering")}</SectionLabel>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button size="sm" variant="outline" width="full" justifyContent="space-between">
                        {selectedOrderingLabel}
                        <Icon as={ChevronDown} color="fg.muted" />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content minW="280px" bg="bg">
                        {ORDERING_OPTIONS.map((option) => (
                          <MenuItem
                            key={option.value}
                            primaryLabel={option.label}
                            isSelected={settings.ordering === option.value}
                            onClick={() => updateField("ordering", option.value)}
                          />
                        ))}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </Stack>
              </Stack>

              <Separator />
              <Stack gap="2xs">
                <SectionLabel>{t("displayMenu.displayProperties")}</SectionLabel>
                <Menu.Root closeOnSelect={false}>
                  <Menu.Trigger asChild>
                    <Button size="sm" variant="outline" width="full" justifyContent="space-between">
                      <Text lineClamp={1}>{selectedDisplayPropertiesLabel}</Text>
                      <Icon as={ChevronDown} color="fg.muted" />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content minW="280px" bg="bg">
                      {DISPLAY_PROPERTY_OPTIONS.map((option) => (
                        <MenuItem
                          key={option.value}
                          primaryLabel={option.label}
                          isSelected={displayPropertiesSet.has(option.value)}
                          onClick={() => handleDisplayPropertyToggle(option.value)}
                        />
                      ))}
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
              </Stack>
            </Stack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
