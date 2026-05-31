import { HStack, Text } from "@chakra-ui/react";
import { ScrollArea, Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { WorkbenchIcon } from "../../../react";
import type { DynamicModuleController, DynamicModuleDefinition } from "../data";

const useEnabledModuleIds = (controller: DynamicModuleController) => {
  const [enabledModuleIds, setEnabledModuleIds] = useState(controller.getEnabledModuleIds());

  useEffect(() => {
    const subscription = controller.subscribe(() => setEnabledModuleIds(controller.getEnabledModuleIds()));
    return () => subscription.dispose();
  }, [controller]);

  return enabledModuleIds;
};

export const DynamicModuleControls = (props: {
  controller: DynamicModuleController;
  definitions: DynamicModuleDefinition[];
}) => {
  const { controller, definitions } = props;
  const enabledModuleIds = useEnabledModuleIds(controller);

  return (
    <ScrollArea
      h="full"
      minW="0"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ display: "flex", alignItems: "center", px: "xs", gap: "sm" }}
    >
      <HStack gap="xs" flexShrink={0}>
        <WorkbenchIcon name="Puzzle" size={14} color="fg.muted" />
        <Text textStyle="label/S/medium" color="fg" whiteSpace="nowrap">
          Runtime modules
        </Text>
      </HStack>
      {definitions.map((definition) => {
        const enabled = enabledModuleIds.includes(definition.id);
        return (
          <HStack
            key={definition.id}
            data-module-id={definition.id}
            gap="2xs"
            flexShrink={0}
            borderLeftWidth="1px"
            borderColor="border.muted"
            pl="sm"
          >
            <WorkbenchIcon name={definition.icon} size={14} color={enabled ? "fg" : "fg.muted"} />
            <Text textStyle="label/S/regular" color={enabled ? "fg" : "fg.muted"} whiteSpace="nowrap">
              {definition.label}
            </Text>
            <Switch
              checked={enabled}
              size="sm"
              aria-label={`${enabled ? "Disable" : "Enable"} ${definition.label}`}
              onCheckedChange={(details) => controller.setEnabled(definition.id, details.checked)}
            />
          </HStack>
        );
      })}
    </ScrollArea>
  );
};
