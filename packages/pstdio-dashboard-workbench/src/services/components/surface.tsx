import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "pstdio-workbench/react";
import type { ReactNode } from "react";

interface SurfacePanelProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  bodyPadding?: string;
}

// Shared chrome for a main-area renderer: an optional titled header and a
// scrollable body. Keeps every dashboard surface visually consistent.
export const SurfacePanel = (props: SurfacePanelProps) => {
  const { title, subtitle, actions, children, bodyPadding = "lg" } = props;

  return (
    <Stack h="full" minH="0" gap="0">
      {title ? (
        <Box
          px="lg"
          py="md"
          borderBottomWidth="1px"
          borderColor="border.muted"
          display="flex"
          alignItems="center"
          gap="md"
        >
          <Stack gap="0" flex="1" minW="0">
            <Text textStyle="label/L/semibold" truncate>
              {title}
            </Text>
            {subtitle ? (
              <Text textStyle="paragraph/S/regular" color="fg.muted" truncate>
                {subtitle}
              </Text>
            ) : null}
          </Stack>
          {actions}
        </Box>
      ) : null}
      <Box flex="1" minH="0" overflowY="auto" p={bodyPadding}>
        {children}
      </Box>
    </Stack>
  );
};

interface SurfaceListRowProps {
  icon?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}

// A single selectable row used by the workspace, session, and settings lists.
export const SurfaceListRow = (props: SurfaceListRowProps) => {
  const { icon, title, description, trailing, onClick } = props;

  return (
    <HStack
      as={onClick ? "button" : "div"}
      w="full"
      textAlign="left"
      gap="sm"
      px="sm"
      py="sm"
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="md"
      bg="bg"
      _hover={onClick ? { borderColor: "border.emphasized" } : undefined}
      onClick={onClick}
    >
      {icon ? <WorkbenchIcon name={icon} size={16} /> : null}
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/M/medium" truncate>
          {title}
        </Text>
        {description ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted" truncate>
            {description}
          </Text>
        ) : null}
      </Stack>
      {trailing}
    </HStack>
  );
};

export const EmptyState = (props: { title: string; description?: string }) => {
  const { title, description } = props;

  return (
    <Stack align="center" justify="center" h="full" minH="160px" gap="2xs" textAlign="center" color="fg.muted">
      <Text textStyle="label/M/medium">{title}</Text>
      {description ? <Text textStyle="paragraph/S/regular">{description}</Text> : null}
    </Stack>
  );
};
