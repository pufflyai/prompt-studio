import { Flex, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface AttachedMenuProps extends Omit<FlexProps, "children"> {
  children?: ReactNode;
}

export const AttachedMenu = (props: AttachedMenuProps) => {
  const { children, ...rest } = props;

  return (
    <Flex as="aside" direction="column" h="full" minH="0" minW="0" w="full" overflow="hidden" bg="bg" {...rest}>
      {children}
    </Flex>
  );
};
