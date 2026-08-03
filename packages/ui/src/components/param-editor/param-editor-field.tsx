import { Box, Flex } from "@chakra-ui/react";
import { BooleanInput } from "./inputs/boolean-input";
import { ColorInput } from "./inputs/color-input";
import { DateInput } from "./inputs/date-input";
import { HorizontalTextInput } from "./inputs/horizontal-text-input";
import { MarkdownInput } from "./inputs/markdown-input";
import { NumberInput } from "./inputs/number-input";
import { ResourceInput } from "./inputs/resource-input";
import { SelectionInput } from "./inputs/selection-input";
import { TextInput } from "./inputs/text-input";
import type { Param, ParamValue, ParamValueMap, ResourceRefValue } from "./param-editor.types";
import { ParamEditorAdvancedField } from "./param-editor-advanced-field";
import { ParamEditorLabel } from "./param-editor-label";
import { isParamEditorRichControl } from "./param-editor-presentation";
import { ParamEditorReadOnlyField } from "./param-editor-read-only-field";
import { ParamEditorReadOnlyValue } from "./param-editor-read-only-value";
import { resolveParamValue } from "./resolve-param-value";

interface ParamEditorFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  onOpenResource?: (ref: ResourceRefValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
  presentation?: "stacked" | "horizontal";
  size?: "xs" | "sm";
}

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
  const {
    param,
    defaultValues,
    onChange,
    onOpenResource,
    readOnly,
    fullWidth = false,
    presentation = "stacked",
    size = "sm",
  } = props;
  const horizontal = presentation === "horizontal";
  const richControl = isParamEditorRichControl(param);
  const common = {
    id: param.id,
    readOnly: readOnly || param.readOnly,
    onChange,
    fullWidth: horizontal ? richControl : fullWidth,
    size,
  };

  switch (param.type) {
    case "number":
      return (
        <NumberInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          step={param.step}
          hideLabel={horizontal}
          hideSlider={horizontal}
        />
      );
    case "boolean":
      return (
        <BooleanInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          hideLabel={horizontal}
        />
      );
    case "text":
      if (horizontal) {
        return (
          <HorizontalTextInput
            {...common}
            name={param.name}
            description={param.description || ""}
            defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
            hideLabel
          />
        );
      }
      return (
        <TextInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          singleLine={param.singleLine}
        />
      );
    case "markdown":
      return (
        <MarkdownInput
          id={param.id}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          placeholder={param.placeholder}
          readOnly={common.readOnly}
          presentation={presentation}
          size={size}
          onChange={onChange}
        />
      );
    case "selection":
      return (
        <SelectionInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          multiSelect={param.multiSelect}
          placeholder={param.placeholder}
          clearable={param.clearable}
          disabled={param.disabled}
          searchable={param.searchable}
          searchPlaceholder={param.searchPlaceholder}
          emptyText={param.emptyText}
          group={
            param.group
              ? {
                  ...param.group,
                  defaultValue: resolveParamValue(defaultValues, param.group.id, param.group.defaultValue),
                }
              : undefined
          }
          hideLabel={horizontal}
        />
      );
    case "date":
      return (
        <DateInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          min={param.min}
          max={param.max}
          hideLabel={horizontal}
        />
      );
    case "color":
      return (
        <ColorInput
          {...common}
          name={param.name}
          description={param.description || ""}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          hideLabel={horizontal}
        />
      );
    case "property":
      return <PropertyField param={param} fullWidth={horizontal ? false : fullWidth} />;
    case "readOnly":
      return <ParamEditorReadOnlyField param={param} fullWidth={horizontal ? false : fullWidth} />;
    case "resource":
      return (
        <ResourceInput
          {...common}
          name={param.name}
          description={param.description}
          defaultValue={resolveParamValue(defaultValues, param.id, param.defaultValue)}
          options={param.options}
          multiSelect={param.multiSelect}
          editable={param.editable}
          placeholder={param.placeholder}
          emptyText={param.emptyText}
          onOpenResource={onOpenResource}
          presentation={presentation}
        />
      );
    case "range":
    case "segmented":
    case "actions":
    case "anchorGrid":
    case "vector":
    case "fileUpload":
      return (
        <ParamEditorAdvancedField
          param={param}
          defaultValues={defaultValues}
          onChange={onChange}
          readOnly={readOnly}
          fullWidth={fullWidth}
          presentation={presentation}
        />
      );
    default:
      return null;
  }
};
