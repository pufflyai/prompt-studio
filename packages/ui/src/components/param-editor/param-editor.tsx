import { Box, Flex, Separator, Stack } from "@chakra-ui/react";
import { Fragment } from "react";
import { ColorInput } from "./color-input";
import { DateInput } from "./date-input";
import { InputGroupComponent } from "./input-group";
import { NumberInput } from "./number-input";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ParamEditorLabel } from "./param-editor-label";
import { SelectionInput } from "./selection-input";
import { TextInput } from "./text-input";

export interface ParamEditorProps {
  params?: Param[];
  groups?: InputGroup[];
  defaultValues?: ParamValueMap;
  onChange?: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

export const ParamEditor = (props: ParamEditorProps) => {
  const { params = [], groups = [], defaultValues = {}, onChange, readOnly, fullWidth = false } = props;
  const handleChange = onChange ?? (() => undefined);

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
      onChange={handleChange}
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
      onChange={handleChange}
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
      onChange={handleChange}
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
      onChange={handleChange}
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
      onChange={handleChange}
      fullWidth={fullWidth}
    />
  );

  const renderPropertyParam = (param: Extract<Param, { type: "property" }>) => {
    if (fullWidth) {
      return (
        <Box key={param.id}>
          <Box mb="xs">
            <ParamEditorLabel name={param.name} description={param.description} />
          </Box>
          <Box minW="0" textStyle="label/S/regular">
            {param.value}
          </Box>
        </Box>
      );
    }

    return (
      <Flex key={param.id} alignItems="center" justifyContent="space-between" minHeight="2rem" gap="xs">
        <ParamEditorLabel name={param.name} description={param.description} />
        <Box minW="0" textStyle="label/S/regular">
          {param.value}
        </Box>
      </Flex>
    );
  };

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
    <Stack flex="1" maxW="full" gap="sm">
      {params.map(renderParam)}

      {params.length > 0 && groups.length > 0 && <Separator borderColor="border.muted" />}

      {groups.map((group, index) => (
        <Fragment key={group.id}>
          <InputGroupComponent
            group={group}
            defaultValues={defaultValues}
            onChange={handleChange}
            readOnly={readOnly}
            fullWidth={fullWidth}
          />
          {index < groups.length - 1 && <Separator borderColor="border.muted" />}
        </Fragment>
      ))}
    </Stack>
  );
};
