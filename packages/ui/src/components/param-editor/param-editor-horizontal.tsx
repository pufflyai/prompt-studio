import { Box, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import type { InputGroup, Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorField } from "./param-editor-field";
import { isParamEditorHorizontalControl, isParamEditorRichControl } from "./param-editor-presentation";

export interface ParamEditorHorizontalProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  variant?: "default" | "small";
}

interface HorizontalGroupProps {
  group: InputGroup;
  params: Param[];
  renderParam: (param: Param) => React.ReactNode;
  variant: "default" | "small";
  width?: "auto" | "full";
}

const HorizontalGroupTitle = (props: { children: string }) => {
  const { children } = props;

  return (
    <Text
      minH="0.75rem"
      textStyle="label/XS"
      color="fg.muted"
      lineHeight="1"
      letterSpacing="0.08em"
      textTransform="uppercase"
    >
      {children}
    </Text>
  );
};

const HorizontalGroup = (props: HorizontalGroupProps) => {
  const { group, params, renderParam, variant, width = "auto" } = props;

  return (
    <VStack
      as="section"
      aria-label={group.title}
      gap={variant === "small" ? "2xs" : "xs"}
      alignItems="start"
      minW="0"
      width={width}
    >
      <HorizontalGroupTitle>{group.title}</HorizontalGroupTitle>
      <HStack gap={variant === "small" ? "2xs" : "xs"} flexWrap="wrap" alignItems="start" minW="0" width={width}>
        {params.map(renderParam)}
      </HStack>
    </VStack>
  );
};

export const ParamEditorHorizontal = (props: ParamEditorHorizontalProps) => {
  const { params = [], groups = [], defaultValues, onChange, onOpenResource, readOnly, variant = "default" } = props;
  const horizontalParams = params.filter(isParamEditorHorizontalControl);
  const horizontalGroups = groups.map((group) => ({
    ...group,
    params: group.params.filter(isParamEditorHorizontalControl),
  }));
  const renderParam = (param: Param) => (
    <ParamEditorField
      key={param.id}
      param={param}
      defaultValues={defaultValues}
      onChange={onChange}
      onOpenResource={onOpenResource}
      readOnly={readOnly}
      presentation="horizontal"
      size={variant === "small" ? "xs" : "sm"}
    />
  );
  const compactParams = horizontalParams.filter((param) => !isParamEditorRichControl(param));
  const richParams = horizontalParams.filter(isParamEditorRichControl);
  const compactGroups = horizontalGroups
    .map((group) => ({ group, params: group.params.filter((param) => !isParamEditorRichControl(param)) }))
    .filter(({ params: groupParams }) => groupParams.length > 0);
  const richGroups = horizontalGroups
    .map((group) => ({ group, params: group.params.filter(isParamEditorRichControl) }))
    .filter(({ params: groupParams }) => groupParams.length > 0);
  const gap = variant === "small" ? "xs" : "sm";
  const hasCompactControls = compactParams.length > 0 || compactGroups.length > 0;

  return (
    <Stack flex="1" maxW="full" gap={gap} minW="0">
      {hasCompactControls ? (
        <HStack gap={gap} flexWrap="wrap" alignItems="start" minW="0">
          {compactParams.map(renderParam)}
          {compactGroups.map(({ group, params: groupParams }) => (
            <HorizontalGroup
              key={group.id}
              group={group}
              params={groupParams}
              renderParam={renderParam}
              variant={variant}
            />
          ))}
        </HStack>
      ) : null}

      {richParams.map((param) => (
        <Box key={param.id} width="full" minW="0">
          {renderParam(param)}
        </Box>
      ))}

      {richGroups.map(({ group, params: groupParams }) => (
        <HorizontalGroup
          key={`${group.id}-rich`}
          group={group}
          params={groupParams}
          renderParam={renderParam}
          variant={variant}
          width="full"
        />
      ))}
    </Stack>
  );
};
