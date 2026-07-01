import { HStack, type StackProps } from "@chakra-ui/react";

interface HorizontalMenuStackProps extends StackProps {
  children?: StackProps["children"];
}

export function HorizontalMenuStack(props: HorizontalMenuStackProps) {
  const { children, h = "41px", px = "xs", py = "xs", borderBottomWidth = "1px", ...rest } = props;

  return (
    <HStack
      {...rest}
      h={h}
      justify="space-between"
      align="center"
      borderBottomWidth={borderBottomWidth}
      borderColor={"border.subtle"}
      px={px}
      py={py}
    >
      {children}
    </HStack>
  );
}
