import { HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface InfoCardProps {
  title: string;
  description: string;
  infoItems?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode | ReactNode[];
  badge?: ReactNode;
}

export const InfoCard = (props: InfoCardProps) => {
  const { title, description, infoItems = [], actions, badge } = props;
  const hasInfoItems = infoItems.length > 0;

  const renderedActions = (() => {
    if (!actions) return null;

    return Array.isArray(actions) ? actions : [actions];
  })();

  return (
    <Stack gap="xs">
      <HStack alignItems="flex-start" justifyContent="space-between" gap="md">
        <Stack flex="1" minW="0">
          <HStack gap="2">
            {badge}
            <Text textStyle="heading/M">{title}</Text>
          </HStack>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {description}
          </Text>
        </Stack>

        {renderedActions ? (
          <HStack gap="xs" alignItems="center">
            {renderedActions.map((action, index) => (
              <Stack key={`info-card-action-${index}`} gap="0">
                {action}
              </Stack>
            ))}
          </HStack>
        ) : null}
      </HStack>

      {hasInfoItems ? (
        <HStack gap="lg" mt="sm" flexWrap="wrap">
          {infoItems.map((info, index) => (
            <Stack key={`info-item-${index}`} gap="2px">
              <Text textStyle="label/S/medium" color="fg.muted">
                {info.label}
              </Text>
              {typeof info.value === "string" ? <Text textStyle="paragraph/S/regular">{info.value}</Text> : info.value}
            </Stack>
          ))}
        </HStack>
      ) : null}
    </Stack>
  );
};
