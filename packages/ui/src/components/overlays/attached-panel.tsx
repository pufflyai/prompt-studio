import { Flex, type FlexProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

const DEFAULT_RESIZABLE_MIN_WIDTH = "20rem";

interface AttachedPanelProps extends Omit<FlexProps, "children"> {
  children?: ReactNode;
  header?: ReactNode;
  resizable?: boolean;
}

export const AttachedPanel = (props: AttachedPanelProps) => {
  const { children, header, width = "28rem", minWidth, resizable = false, ...rest } = props;
  const resolvedMinWidth = minWidth ?? (resizable ? DEFAULT_RESIZABLE_MIN_WIDTH : width);
  const resolvedWidth = resizable ? "full" : width;

  return (
    <Flex
      direction="column"
      position="relative"
      flexShrink={0}
      w={resolvedWidth}
      minW={resolvedMinWidth}
      h="100%"
      borderLeftWidth="1px"
      bg="bg"
      overflow="hidden"
      {...rest}
    >
      {header}
      <Flex flex="1" minH={0} direction="column">
        {children}
      </Flex>
    </Flex>
  );
};
