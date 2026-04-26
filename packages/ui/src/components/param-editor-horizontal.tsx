import { HStack, Stack, Text, VStack } from "@chakra-ui/react";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ColorInput } from "./param-editor-color-input";
import { DateInput } from "./param-editor-date-input";
import { HorizontalTextInput } from "./param-editor-horizontal-text-input";
import { NumberInput } from "./param-editor-number-input";
import { SelectionInput } from "./param-editor-selection-input";

export interface ParamEditorHorizontalProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean; // This option doesn't do anything in horizontal mode
}

interface ParamEditorHorizontalFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

const ParamEditorHorizontalField = (props: ParamEditorHorizontalFieldProps) => {
  const { param, defaultValues, onChange, readOnly } = props;

  switch (param.type) {
    case "number":
      return (
        <NumberInput
          hideLabel
          hideSlider
          readOnly={readOnly}
          id={param.id}
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
    case "text":
      return (
        <HorizontalTextInput
          hideLabel
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          onChange={onChange}
          tooltipPlacement="top"
        />
      );
    case "selection":
      return (
        <SelectionInput
          hideLabel
          readOnly={readOnly}
          id={param.id}
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
    case "date":
      return (
        <DateInput
          hideLabel
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          onChange={onChange}
          tooltipPlacement="top"
        />
      );
    case "color":
      return (
        <ColorInput
          hideLabel
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          onChange={onChange}
          tooltipPlacement="top"
        />
      );
    default:
      return null;
  }
};

export const ParamEditorHorizontal = (props: ParamEditorHorizontalProps) => {
  const { params = [], groups = [], defaultValues, onChange, readOnly } = props;

  return (
    <Stack direction="row" flex="1" maxW="full" gap="sm" flexWrap="wrap">
      {/* Render standalone params */}
      {params.map((param) => (
        <ParamEditorHorizontalField
          key={param.id}
          param={param}
          defaultValues={defaultValues}
          onChange={onChange}
          readOnly={readOnly}
        />
      ))}

      {/* Render grouped params */}
      {groups.map((group) => (
        <VStack key={group.id} gap="xs" align="start">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            {group.title}
          </Text>
          <HStack gap="xs">
            {group.params.map((param) => (
              <ParamEditorHorizontalField
                key={param.id}
                param={param}
                defaultValues={defaultValues}
                onChange={onChange}
                readOnly={readOnly}
              />
            ))}
          </HStack>
        </VStack>
      ))}
    </Stack>
  );
};
