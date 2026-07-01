import { Flex, type FlexProps } from "@chakra-ui/react";

interface ParamEditorInlineGroupProps extends FlexProps {}

// A horizontal row of controls that share a line (e.g. paired x/y inputs).
export const ParamEditorInlineGroup = (props: ParamEditorInlineGroupProps) => {
  const { children, ...rest } = props;

  return (
    <Flex alignItems="center" gap="xs" minW="0" {...rest}>
      {children}
    </Flex>
  );
};
