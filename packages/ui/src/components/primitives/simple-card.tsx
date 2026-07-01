import { Box, type BoxProps } from "@chakra-ui/react";

export type SimpleCardProps = BoxProps;

export const SimpleCard = (props: SimpleCardProps) => {
  const { children, ...rest } = props;

  return (
    <Box borderWidth="1px" borderColor="border.subtle" borderRadius="xs" bg="bg" {...rest}>
      {children}
    </Box>
  );
};

export type SimpleCardBodyProps = BoxProps;

export const SimpleCardBody = (props: SimpleCardBodyProps) => {
  const { children, ...rest } = props;

  return (
    <Box p="md" {...rest}>
      {children}
    </Box>
  );
};
