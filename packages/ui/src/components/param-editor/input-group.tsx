import { Box, Button, Collapsible, Flex, Stack, Text, useDisclosure } from "@chakra-ui/react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { ColorInput } from "./color-input";
import { DateInput } from "./date-input";
import { NumberInput } from "./number-input";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ParamEditorLabel } from "./param-editor-label";
import { SelectionInput } from "./selection-input";
import { TextInput } from "./text-input";

interface InputGroupComponentProps {
  group: InputGroup;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

export const InputGroupComponent = (props: InputGroupComponentProps) => {
  const { group, defaultValues, onChange, readOnly, fullWidth = false } = props;
  const { open, onToggle } = useDisclosure({
    defaultOpen: !group.defaultCollapsed,
  });

  const renderNumberParam = (param: Extract<Param, { type: "number" }>) => (
    <NumberInput
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
      defaultValue={resolveDefaultValue(defaultValues, param.id, param.defaultValue)}
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
    <Box>
      {group.collapsible ? (
        <Button variant="ghost" size="xs" onClick={onToggle} pl={0} _hover={{ bg: "transparent" }}>
          <Flex alignItems="center" gap="xs">
            <Text textStyle="label/M/medium">{group.title}</Text>
            {open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
          </Flex>
        </Button>
      ) : (
        <Text textStyle="label/M/medium">{group.title}</Text>
      )}

      {group.description && (
        <Text textStyle="label/S/regular" color="fg.muted" mb="sm">
          {group.description}
        </Text>
      )}

      <Collapsible.Root open={group.collapsible ? open : true}>
        <Collapsible.Content>
          <Stack gap="md">{group.params.map(renderParam)}</Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
