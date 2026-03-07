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

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

export const ParamEditor = (props: ParamEditorProps) => {
  const { params = [], groups = [], defaultValues, onChange, readOnly, fullWidth = false } = props;

  const renderNumberParam = (param: Extract<Param, { type: "number" }>) => (
    <NumberInput
      readOnly={readOnly}
      id={param.id}
      key={param.id}
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

  const renderTextParam = (param: Extract<Param, { type: "text" }>) => (
    <TextInput
      readOnly={readOnly}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      singleLine={param.singleLine}
      onChange={onChange}
      fullWidth={fullWidth}
    />
  );

  const renderSelectionParam = (param: Extract<Param, { type: "selection" }>) => (
    <SelectionInput
      readOnly={readOnly}
      id={param.id}
      key={param.id}
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

  const renderDateParam = (param: Extract<Param, { type: "date" }>) => (
    <DateInput
      readOnly={readOnly}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue ?? param.min)}
      min={param.min}
      max={param.max}
      onChange={onChange}
      fullWidth={fullWidth}
    />
  );

  const renderColorParam = (param: Extract<Param, { type: "color" }>) => (
    <ColorInput
      readOnly={readOnly}
      id={param.id}
      key={param.id}
      name={param.name}
      description={param.description || ""}
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
      onChange={onChange}
      fullWidth={fullWidth}
    />
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
      default:
        return null;
    }
  };

  return (
    <Stack flex="1" maxW="full" gap="md">
      {/* Render standalone params */}
      {params.map(renderParam)}

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
