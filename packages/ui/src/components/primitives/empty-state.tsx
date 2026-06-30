import { EmptyState as ChakraEmptyState, VStack } from "@chakra-ui/react";
import * as React from "react";

/** Centered empty-state message with optional icon, description, and follow-up actions. */
export interface EmptyStateProps extends ChakraEmptyState.RootProps {
  /** Primary empty-state message. */
  title: string;
  /** Supporting explanation shown below the title. */
  description?: string;
  /** Decorative or semantic icon shown above the message. */
  icon?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(props, ref) {
  const { title, description, icon, children, ...rest } = props;
  return (
    <ChakraEmptyState.Root ref={ref} {...rest}>
      <ChakraEmptyState.Content>
        {icon && <ChakraEmptyState.Indicator>{icon}</ChakraEmptyState.Indicator>}
        {description ? (
          <VStack textAlign="center">
            <ChakraEmptyState.Title fontWeight="normal">{title}</ChakraEmptyState.Title>
            <ChakraEmptyState.Description>{description}</ChakraEmptyState.Description>
          </VStack>
        ) : (
          <ChakraEmptyState.Title fontWeight="normal">{title}</ChakraEmptyState.Title>
        )}
        {children}
      </ChakraEmptyState.Content>
    </ChakraEmptyState.Root>
  );
});
