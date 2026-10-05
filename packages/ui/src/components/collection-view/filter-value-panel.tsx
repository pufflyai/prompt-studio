import { Stack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { ParamEditorFieldLabel } from "../param-editor/param-editor-field-label";

interface FilterValuePanelProps {
  children: ReactNode;
}

export const FilterValuePanel = (props: FilterValuePanelProps) => {
  const { children } = props;
  return (
    <Stack height="full" minH="0" gap="xs" padding="sm" minW="0">
      <ParamEditorFieldLabel name="Value" />
      {children}
    </Stack>
  );
};
