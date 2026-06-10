import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { SearchableMenu, type SearchableMenuItem } from "@pstdio/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import type { WorkbenchCore } from "pstdio-workbench/core";
import type { CommandParamFieldProps } from "pstdio-workbench/react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { getProjectTemplateAssets } from "@/shared/projects/project-api";
import { ParamFieldLabel } from "./param-field-shared";
import { buildTemplateParamOptions } from "./template-param-options";

interface TemplateParamFieldProps extends CommandParamFieldProps {
  workbench: WorkbenchCore;
}

// The template param is optional, so an empty selection means "no template".
const NONE_VALUE = "";
const NONE_LABEL = "None";

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
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? NONE_LABEL;

  const items: SearchableMenuItem[] = [
    {
      id: NONE_VALUE,
      label: NONE_LABEL,
      isSelected: selectedValue === NONE_VALUE,
      onSelect: () => onChange(NONE_VALUE),
    },
    ...options.map((option) => ({
      id: option.value,
      label: option.label,
      isSelected: option.value === selectedValue,
      onSelect: () => onChange(option.value),
    })),
  ];

  return (
    <Stack gap="2xs">
      <ParamFieldLabel entry={entry} />
      <SearchableMenu
        trigger={
          <Button size="sm" variant="outline" justifyContent="space-between" disabled={disabled || isLoading}>
            {isLoading ? "Loading templates..." : selectedLabel}
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        }
        items={items}
        showSearch={options.length > 5}
        searchPlaceholder="Search templates..."
        width="260px"
        portalled={false}
        emptyState={
          <Box px="sm" py="xs">
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              No templates
            </Text>
          </Box>
        }
      />
    </Stack>
  );
};
