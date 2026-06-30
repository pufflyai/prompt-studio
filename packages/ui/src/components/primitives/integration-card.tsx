import { Badge, Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { SimpleCard, SimpleCardBody } from "@/components/primitives/simple-card";

export interface IntegrationCardProps {
  icon: ReactNode;
  name: string;
  description: string;
  id: string;
  version?: string;
  category?: string;
  active?: boolean;
  actionLabel?: string;
}

export const IntegrationCard = (props: IntegrationCardProps) => {
  const { icon, name, description, id, version, category, active = false, actionLabel } = props;

  return (
    <SimpleCard>
      <SimpleCardBody>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            {icon}
          </Icon>
          <Box flex="1" minW="0">
            <Stack gap="1">
              <HStack gap="2" flexWrap="wrap">
                <Text textStyle="sm" fontWeight="semibold">
                  {name}
                </Text>
                <Badge size="sm" variant="outline">
                  {id}
                </Badge>
                {version && (
                  <Badge size="sm" variant="outline">
                    v{version}
                  </Badge>
                )}
                {category && (
                  <Badge size="sm" variant="outline">
                    {category}
                  </Badge>
                )}
              </HStack>
              <Text color="fg.muted">{description}</Text>
            </Stack>
          </Box>
          <Button
            type="button"
            disabled={active}
            size="sm"
            variant="outline"
            colorPalette="gray"
            bg="bg"
            flexShrink="0"
          >
            {active && (
              <Icon color="fg.success">
                <Check />
              </Icon>
            )}
            {actionLabel ?? (active ? "Active" : "Connect")}
          </Button>
        </HStack>
      </SimpleCardBody>
    </SimpleCard>
  );
};
