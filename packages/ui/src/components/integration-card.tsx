import { Badge, Box, Button, Card, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export interface IntegrationCardProps {
  icon: ReactNode;
  name: string;
  description: string;
  id: string;
  version?: string;
  category?: string;
  active?: boolean;
  actionLabel?: string;
  metadata?: Array<{ label: string; value: ReactNode }>;
}

export const IntegrationCard = (props: IntegrationCardProps) => {
  const { icon, name, description, id, version, category, active = false, actionLabel, metadata = [] } = props;

  return (
    <Card.Root size="sm" borderRadius="0">
      <Card.Body>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            {icon}
          </Icon>
          <Box flex="1" minW="0">
            <Stack gap="1">
              <HStack gap="2" flexWrap="wrap">
                <Card.Title textStyle="sm">{name}</Card.Title>
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
              <Card.Description>{description}</Card.Description>
              {metadata.map((item) => (
                <Text key={item.label} textStyle="paragraph/XS/regular" color="fg.muted">
                  {item.label}: {item.value}
                </Text>
              ))}
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
      </Card.Body>
    </Card.Root>
  );
};
