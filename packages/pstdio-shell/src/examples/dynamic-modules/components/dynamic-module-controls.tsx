import { HStack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { ShellIcon } from "../../../react";
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
    <HStack h="full" minW="0" overflowX="auto" overflowY="hidden" px="xs" gap="sm">
      <HStack gap="xs" flexShrink={0}>
        <ShellIcon name="Puzzle" size={14} color="fg.muted" />
        <Text textStyle="label/S/medium" color="fg" whiteSpace="nowrap">
          Runtime modules
        </Text>
      </HStack>
      {definitions.map((definition) => {
        const enabled = enabledModuleIds.includes(definition.id);
        return (
          <HStack key={definition.id} gap="2xs" flexShrink={0} borderLeftWidth="1px" borderColor="border.muted" pl="sm">
            <ShellIcon name={definition.icon} size={14} color={enabled ? "fg" : "fg.muted"} />
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
    </HStack>
  );
};
