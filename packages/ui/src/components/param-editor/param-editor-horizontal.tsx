import { HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { ColorInput } from "./color-input";
import { DateInput } from "./date-input";
import { HorizontalTextInput } from "./horizontal-text-input";
import { NumberInput } from "./number-input";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ParamEditorLabel } from "./param-editor-label";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";
import { SelectionInput } from "./selection-input";

export interface ParamEditorHorizontalProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean; // This option doesn't do anything in horizontal mode
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

export const ParamEditorHorizontal = (props: ParamEditorHorizontalProps) => {
  const { params = [], groups = [], defaultValues, onChange, readOnly } = props;

  const renderNumberParam = (param: Extract<Param, { type: "number" }>) => (
    <NumberInput
      hideLabel
      hideSlider
      readOnly={readOnly}
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
      readOnly={readOnly}
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
      readOnly={readOnly}
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
    />
  );

  const renderDateParam = (param: Extract<Param, { type: "date" }>) => (
    <DateInput
      hideLabel
      readOnly={readOnly}
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
      readOnly={readOnly}
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
      default:
        return null;
    }
  };

  return (
    <Stack direction="row" flex="1" maxW="full" gap="sm" flexWrap="wrap">
      {/* Render standalone params */}
      {params.map(renderParam)}

      {/* Render grouped params */}
      {groups.map((group) => (
        <VStack key={group.id} gap="xs" align="start">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            {group.title}
          </Text>
          <HStack gap="xs">{group.params.map(renderParam)}</HStack>
        </VStack>
      ))}
    </Stack>
  );
};
