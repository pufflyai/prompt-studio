import { Badge, Box, Button, Card, HStack, Icon, Stack } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { Orbit } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HarnessCardProps {
  agentId: string;
  name: string;
  isInstalled: boolean;
  isEnabled: boolean;
  binaryPath?: string;
  isMutating: boolean;
  onToggleEnabled: () => void;
  onAddManually?: () => void;
}

export const HarnessCard = (props: HarnessCardProps) => {
  const { agentId, name, isInstalled, isEnabled, binaryPath, isMutating, onToggleEnabled, onAddManually } = props;
  const { t } = useTranslation("settings");

  const toggleDisabled = isMutating || (!isInstalled && !isEnabled);
  const tooltipLabel = isEnabled ? t("agentRow.toggleEnabled") : t("agentRow.toggleDisabled");
  const statusLabel = isInstalled ? t("agentRow.installed") : t("agentRow.disconnected");
  const description = binaryPath ? `${statusLabel} · ${binaryPath}` : statusLabel;

  return (
    <Card.Root size="sm" borderRadius="0" data-testid="harness-card" opacity={isEnabled ? 1 : 0.7}>
      <Card.Body>
        <HStack gap="4" alignItems="flex-start">
          <Icon boxSize="1em" fontSize="2xl" flexShrink="0" color="fg.muted">
            <Orbit />
          </Icon>
          <Box flex="1" minW="0">
            <Stack gap="1">
              <HStack gap="2" flexWrap="wrap">
                <Card.Title textStyle="sm">{name}</Card.Title>
                <Badge size="sm" variant="outline">
                  {agentId}
                </Badge>
              </HStack>
              <Card.Description>{description}</Card.Description>
            </Stack>
          </Box>
          <HStack gap="2" flexShrink="0" alignItems="center">
            {!isInstalled && !isEnabled && onAddManually ? (
              <Button size="xs" variant="outline" onClick={onAddManually} disabled={isMutating}>
                {t("agentList.addAgentManually")}
              </Button>
            ) : null}
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggleEnabled}
              disabled={toggleDisabled}
              aria-label={tooltipLabel}
            />
          </HStack>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
};
