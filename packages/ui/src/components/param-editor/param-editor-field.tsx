import { Box, Flex } from "@chakra-ui/react";
import { ColorInput } from "./color-input";
import { DateInput } from "./date-input";
import { NumberInput } from "./number-input";
import type { Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ParamEditorControlField } from "./param-editor-control-field";
import { ParamEditorLabel } from "./param-editor-label";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";
import { SelectionInput } from "./selection-input";
import { TextInput } from "./text-input";

interface ParamEditorFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

const PropertyField = (props: { param: Extract<Param, { type: "property" }>; fullWidth?: boolean }) => {
  const { param, fullWidth } = props;

  if (fullWidth) {
    return (
      <Box>
        <Box mb="xs">
          <ParamEditorLabel name={param.name} description={param.description} />
        </Box>
        <ParamEditorReadOnlyValue>{param.value}</ParamEditorReadOnlyValue>
      </Box>
    );
  }

  return (
    <Flex alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
      <ParamEditorLabel name={param.name} description={param.description} />
      <ParamEditorReadOnlyValue>{param.value}</ParamEditorReadOnlyValue>
    </Flex>
  );
};

export const ParamEditorField = (props: ParamEditorFieldProps) => {
  const { param, defaultValues, onChange, readOnly, fullWidth = false } = props;

  switch (param.type) {
    case "number":
      return (
        <NumberInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "text":
      return (
        <TextInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          singleLine={param.singleLine}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "selection":
      return (
        <SelectionInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          onChange={onChange}
          multiSelect={param.multiSelect}
          placeholder={param.placeholder}
          fullWidth={fullWidth}
        />
      );
    case "date":
      return (
        <DateInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "color":
      return (
        <ColorInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
          onChange={onChange}
          fullWidth={fullWidth}
        />
      );
    case "property":
      return <PropertyField param={param} fullWidth={fullWidth} />;
    default:
      return (
        <ParamEditorControlField
          param={param}
          defaultValues={defaultValues}
          onChange={onChange}
          readOnly={readOnly}
          fullWidth={fullWidth}
        />
      );
  }
};
