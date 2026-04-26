import { Box, Button, Collapsible, Flex, Stack, Text, useDisclosure } from "@chakra-ui/react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import type { InputGroup, Param, ParamValue, ParamValueMap } from "./param-editor.types";
import { ColorInput } from "./param-editor-color-input";
import { DateInput } from "./param-editor-date-input";
import { NumberInput } from "./param-editor-number-input";
import { SelectionInput } from "./param-editor-selection-input";
import { TextInput } from "./param-editor-text-input";

interface InputGroupComponentProps {
  group: InputGroup;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

interface InputGroupFieldProps {
  param: Param;
  defaultValues: ParamValueMap;
  onChange: (id: string, value: ParamValue) => void;
  readOnly?: boolean;
  fullWidth: boolean;
}

const resolveDefaultValue = <T,>(defaultValues: ParamValueMap, paramId: string, fallback: T) => {
  return defaultValues[paramId] === undefined ? fallback : (defaultValues[paramId] as T);
};

const InputGroupField = (props: InputGroupFieldProps) => {
  const { param, defaultValues, onChange, readOnly, fullWidth } = props;

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
    default:
      return null;
  }
};

export const InputGroupComponent = (props: InputGroupComponentProps) => {
  const { group, defaultValues, onChange, readOnly, fullWidth = false } = props;
  const { open, onToggle } = useDisclosure({
    defaultOpen: !group.defaultCollapsed,
  });

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
          <Stack gap="md">
            {group.params.map((param) => (
              <InputGroupField
                key={param.id}
                param={param}
                defaultValues={defaultValues}
                onChange={onChange}
                readOnly={readOnly}
                fullWidth={fullWidth}
              />
            ))}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
