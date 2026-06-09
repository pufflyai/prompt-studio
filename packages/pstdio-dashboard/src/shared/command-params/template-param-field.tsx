import { Button, HStack, Menu, Stack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import type { WorkbenchCore } from "pstdio-workbench/core";
import type { CommandParamFieldProps } from "pstdio-workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { getProjectTemplateAssets } from "@/shared/projects/project-api";
import { ParamFieldLabel } from "./param-field-shared";
import { buildTemplateParamOptions } from "./template-param-options";

interface TemplateParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

const getStringValue = (value: CommandParamFieldProps["value"]) => (typeof value === "string" ? value : "");

const templateQueryKey = (projectId: string | undefined) => ["project-template-assets", projectId];

export const TemplateParamField = (props: TemplateParamFieldProps) => {
  const { entry, value, disabled, onChange, workbench } = props;
  const projectId = getDashboardSelectedProjectId(workbench);
  const selectedValue = getStringValue(value);
  const { data: templates = [], isLoading } = useQuery({
    queryKey: templateQueryKey(projectId),
    queryFn: () => (projectId ? getProjectTemplateAssets(projectId) : Promise.resolve([])),
    enabled: Boolean(projectId),
  });
  const options = buildTemplateParamOptions(templates, entry);
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? selectedValue;
  const isDisabled = disabled || isLoading || options.length === 0;

  return (
    <Stack gap="2xs">
      <ParamFieldLabel entry={entry} />
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" justifyContent="space-between" disabled={isDisabled}>
            {isLoading ? "Loading templates..." : selectedLabel || "Select template..."}
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content maxH="260px" overflowY="auto">
            {options.map((option) => (
              <Menu.Item
                key={option.value || "__default_template__"}
                value={option.value || "__default_template__"}
                onClick={() => onChange(option.value)}
              >
                <HStack gap="2" minW="0">
                  {selectedValue === option.value ? <Check size={14} aria-hidden="true" /> : null}
                  <Text truncate>{option.label}</Text>
                </HStack>
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Stack>
  );
};
