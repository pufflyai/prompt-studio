import { HStack, type StackProps } from "@chakra-ui/react";
import * as React from "react";

export type HeaderVariant = "main" | "narrow" | "input";

interface HeaderVariantStyles {
  h: string;
  px: string;
}

const headerVariantStyles: Record<HeaderVariant, HeaderVariantStyles> = {
  main: {
    h: "2.5rem",
    px: "xs",
  },
  narrow: {
    h: "2rem",
    px: "xs",
  },
  input: {
    h: "3rem",
    px: "0",
  },
};

export interface HeaderProps extends Omit<StackProps, "variant"> {
  variant?: HeaderVariant;
}

export const Header = React.forwardRef<HTMLDivElement, HeaderProps>(function Header(props, ref) {
  const { variant = "main", children, ...rest } = props;

  return (
    <HStack ref={ref} as="header" alignItems="center" borderWidth="0" {...headerVariantStyles[variant]} {...rest}>
      {children}
    </HStack>
  );
});
