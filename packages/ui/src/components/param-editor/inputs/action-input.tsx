import { Button, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { ActionOption } from "../param-editor.types";
import { ParamEditorControlItem } from "../param-editor-control-item";

interface ActionInputProps {
  id: string;
  name: string;
  description?: string;
  defaultValue?: string;
  options: ActionOption[];
  onChange: (id: string, value: string) => void;
  readOnly?: boolean;
  fullWidth?: boolean;
}

export const ActionInput = (props: ActionInputProps) => {
  const { id, name, description, defaultValue, options, onChange, readOnly } = props;
  const [active, setActive] = useState(defaultValue);

  useEffect(() => {
    setActive(defaultValue);
  }, [defaultValue]);

  const run = (optionId: string) => {
    setActive(optionId);
    onChange(id, optionId);
  };

  const row = (
    <Flex gap="xs" wrap="wrap">
      {options.map((option) => (
        <Button
          key={option.id}
          size="xs"
          variant={active === option.id ? "subtle" : "outline"}
          disabled={option.disabled || readOnly}
          _hover={{ bg: "bg.hover", borderColor: "border.accent-light" }}
          _active={{ bg: "bg.active", borderColor: "border.accent-light" }}
          _focusVisible={{ borderColor: "border.accent-light", outline: "none", boxShadow: "none" }}
          onClick={() => run(option.id)}
        >
          {option.name}
        </Button>
      ))}
    </Flex>
  );

  return (
    <ParamEditorControlItem name={name} description={description} orientation="stacked">
      {row}
    </ParamEditorControlItem>
  );
};
