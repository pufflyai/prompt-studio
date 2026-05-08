import type { StackProps } from "@chakra-ui/react";
import { HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface ActivityRootProps extends StackProps {
  children: ReactNode;
}

export interface ActivityHeaderProps extends Omit<StackProps, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
}

export interface ActivityFeedProps extends StackProps {
  children: ReactNode;
}

export const ActivityRoot = (props: ActivityRootProps) => {
  const { children, ...rootProps } = props;

  return (
    <Stack width="full" gap="md" {...rootProps}>
      {children}
    </Stack>
  );
};

export const ActivityHeader = (props: ActivityHeaderProps) => {
  const { title = "Activity", actions, ...rootProps } = props;

  return (
    <HStack alignItems="center" justifyContent="space-between" gap="md" {...rootProps}>
      <Text textStyle="label/M/medium" color="fg">
        {title}
      </Text>
      {actions ? <HStack gap="xs">{actions}</HStack> : null}
    </HStack>
  );
};

export const ActivityFeed = (props: ActivityFeedProps) => {
  const { children, ...rootProps } = props;

  return (
    <Stack gap="md" width="full" {...rootProps}>
      {children}
    </Stack>
  );
};
