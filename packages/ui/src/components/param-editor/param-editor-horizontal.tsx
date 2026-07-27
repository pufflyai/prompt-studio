import { HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { ColorInput } from "./inputs/color-input";
import { DateInput } from "./inputs/date-input";
import { HorizontalTextInput } from "./inputs/horizontal-text-input";
import { NumberInput } from "./inputs/number-input";
import { SelectionInput } from "./inputs/selection-input";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ParamEditorLabel } from "./param-editor-label";
import { ParamEditorReadOnlyField } from "./param-editor-read-only-field";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";

export interface ParamEditorHorizontalProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean; // This option doesn't do anything in horizontal mode
  variant?: "default" | "small";
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

export const ParamEditorHorizontal = (props: ParamEditorHorizontalProps) => {
  const { params = [], groups = [], defaultValues, onChange, readOnly, variant = "default" } = props;
  const isReadOnly = (param: Param) => readOnly || param.readOnly;

  const renderNumberParam = (param: Extract<Param, { type: "number" }>) => (
    <NumberInput
      hideLabel
      hideSlider
      readOnly={isReadOnly(param)}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      min={param.min}
      max={param.max}
      step={param.step}
      onChange={onChange}
      tooltipPlacement="top"
    />
  );

  const renderTextParam = (param: Extract<Param, { type: "text" }>) => (
    <HorizontalTextInput
      hideLabel
      readOnly={isReadOnly(param)}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      onChange={onChange}
      tooltipPlacement="top"
    />
  );

  const renderSelectionParam = (param: Extract<Param, { type: "selection" }>) => (
    <SelectionInput
      hideLabel
      readOnly={isReadOnly(param)}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      options={param.options}
      onChange={onChange}
      multiSelect={param.multiSelect}
      tooltipPlacement="top"
      placeholder={param.placeholder}
      clearable={param.clearable}
      disabled={param.disabled}
    />
  );

  const renderDateParam = (param: Extract<Param, { type: "date" }>) => (
    <DateInput
      hideLabel
      readOnly={isReadOnly(param)}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      min={param.min}
      max={param.max}
      onChange={onChange}
      tooltipPlacement="top"
    />
  );

  const renderColorParam = (param: Extract<Param, { type: "color" }>) => (
    <ColorInput
      hideLabel
      readOnly={isReadOnly(param)}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      onChange={onChange}
      tooltipPlacement="top"
    />
  );

  const renderPropertyParam = (param: Extract<Param, { type: "property" }>) => (
    <HStack key={param.id} gap="xs" alignItems="center">
      <ParamEditorLabel name={param.name} description={param.description} />
      <ParamEditorReadOnlyValue>{param.value}</ParamEditorReadOnlyValue>
    </HStack>
  );

  const renderParam = (param: Param) => {
    switch (param.type) {
      case "number":
        return renderNumberParam(param);
      case "text":
        return renderTextParam(param);
      case "selection":
        return renderSelectionParam(param);
      case "date":
        return renderDateParam(param);
      case "color":
        return renderColorParam(param);
      case "property":
        return renderPropertyParam(param);
      case "readOnly":
        return <ParamEditorReadOnlyField key={param.id} param={param} />;
      default:
        return null;
    }
  };

  return (
    <Stack direction="row" flex="1" maxW="full" gap={variant === "small" ? "xs" : "sm"} flexWrap="wrap">
      {/* Render standalone params */}
      {params.map(renderParam)}

      {/* Render grouped params */}
      {groups.map((group) => (
        <VStack key={group.id} gap={variant === "small" ? "2xs" : "xs"} align="start">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            {group.title}
          </Text>
          <HStack gap={variant === "small" ? "2xs" : "xs"}>{group.params.map(renderParam)}</HStack>
        </VStack>
      ))}
    </Stack>
  );
};
