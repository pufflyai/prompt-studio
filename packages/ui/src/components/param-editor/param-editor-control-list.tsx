import { Stack, type StackProps } from "@chakra-ui/react";

interface ParamEditorControlListProps extends StackProps {}

// A vertical stack of control items with consistent authoring density. Use it to
// compose control layouts outside a full <ParamEditor> section.
export const ParamEditorControlList = (props: ParamEditorControlListProps) => {
  const { children, ...rest } = props;

  return (
    <Stack gap="sm" minW="0" {...rest}>
      {children}
    </Stack>
  );
};
