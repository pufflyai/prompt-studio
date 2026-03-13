import { ChakraProvider } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import type { ReactNode } from "react";

interface RootProviderProps {
  children: ReactNode;
}

export const RootProvider = (props: RootProviderProps) => {
  const { children } = props;

  return <ChakraProvider value={psTheme}>{children}</ChakraProvider>;
};
