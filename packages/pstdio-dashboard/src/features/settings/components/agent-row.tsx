import { Badge, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { CheckCircle, Terminal, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AgentRowProps {
  name: string;
  isInstalled: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  isToggling: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}

export const AgentRow = (props: AgentRowProps) => {
  const { t } = useTranslation("settings");
  const { name, isInstalled, isEnabled, isDefault, isToggling, onToggle, onSetDefault } = props;

  return (
    <HStack
      justify="space-between"
      alignItems="center"
      px="md"
      py="sm"
      borderWidth="1px"
      borderColor="border.secondary"
      borderRadius="md"
    >
      <HStack gap="sm" alignItems="center">
        <Terminal size={18} />

        <Stack gap="0">
          <HStack gap="xs">
            <Text textStyle="label/S/medium">{name}</Text>
            {isEnabled && isDefault && (
              <Badge size="sm" colorPalette="blue">
                {t("agentRow.default")}
              </Badge>
            )}
          </HStack>

          <HStack gap="2xs" alignItems="center">
            {isInstalled ? (
              <>
                <CheckCircle size={12} color="var(--chakra-colors-foreground-feedback-success)" />
                <Text textStyle="paragraph/XS/regular" color="foreground.feedback.success">
                  {t("agentRow.installed")}
                </Text>
              </>
            ) : (
              <>
                <XCircle size={12} color="var(--chakra-colors-foreground-secondary)" />
                <Text textStyle="paragraph/XS/regular" color="foreground.secondary">
                  {t("agentRow.notFound")}
                </Text>
              </>
            )}
          </HStack>
        </Stack>
      </HStack>

      <HStack gap="sm">
        {isEnabled && !isDefault && (
          <Button size="xs" variant="outline" onClick={onSetDefault}>
            {t("agentRow.setAsDefault")}
          </Button>
        )}

        <Switch checked={isEnabled} onCheckedChange={onToggle} disabled={!isInstalled || isToggling} />
      </HStack>
    </HStack>
  );
};
