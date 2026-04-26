import { Separator, Stack } from "@chakra-ui/react";
import { Fragment } from "react";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ColorInput } from "./param-editor-color-input";
import { DateInput } from "./param-editor-date-input";
import { InputGroupComponent } from "./param-editor-input-group";
import { NumberInput } from "./param-editor-number-input";
import { SelectionInput } from "./param-editor-selection-input";
import { TextInput } from "./param-editor-text-input";

export interface ParamEditorProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

interface ParamEditorFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

const ParamEditorField = (props: ParamEditorFieldProps) => {
  const { param, defaultValues, onChange, readOnly, fullWidth } = props;

  switch (param.type) {
    case "number":
      return (
        <NumberInput
          readOnly={readOnly}
          id={param.id}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue ?? param.min)}
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
          defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue ?? param.min)}
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
    default:
      return null;
  }
};

export const ParamEditor = (props: ParamEditorProps) => {
  const { params = [], groups = [], defaultValues, onChange, readOnly, fullWidth = false } = props;

  return (
    <Stack flex="1" maxW="full" gap="md">
      {/* Render standalone params */}
      {params.map((param) => (
        <ParamEditorField
          key={param.id}
          param={param}
          defaultValues={defaultValues}
          onChange={onChange}
          readOnly={readOnly}
          fullWidth={fullWidth}
        />
      ))}

      {/* Add separator between standalone params and groups if both exist */}
      {params.length > 0 && groups.length > 0 && <Separator borderColor="border.muted" />}

      {/* Render groups with separators */}
      {groups.map((group, index) => (
        <Fragment key={group.id}>
          <InputGroupComponent
            group={group}
            defaultValues={defaultValues}
            onChange={onChange}
            readOnly={readOnly}
            fullWidth={fullWidth}
          />
          {/* Add divider after each group except the last one */}
          {index < groups.length - 1 && <Separator borderColor="border.muted" />}
        </Fragment>
      ))}
    </Stack>
  );
};
