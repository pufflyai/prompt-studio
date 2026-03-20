import { Badge, Box, HStack, Icon, IconButton, Menu, Table, Text } from "@chakra-ui/react";
import { MenuItem, Switch, Tooltip } from "@pstdio/ui";
import { Circle, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

const ROW_HEIGHT = "48px";

interface AgentRowProps {
  name: string;
  isInstalled: boolean;
  isEnabled: boolean;
  isDefault: boolean;
  binaryPath?: string;
  isToggling: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}

export const AgentRow = (props: AgentRowProps) => {
  const { t } = useTranslation("settings");
  const { name, isInstalled, isEnabled, isDefault, binaryPath, isToggling, onToggle, onSetDefault } = props;

  const toggleDisabled = isToggling || (!isInstalled && !isEnabled);
  const tooltipLabel = isEnabled ? t("agentRow.toggleEnabled") : t("agentRow.toggleDisabled");

  return (
    <Table.Row height={ROW_HEIGHT}>
      <Table.Cell>
        <HStack gap="xs">
          <Text textStyle="label/S/medium">{name}</Text>
          {isEnabled && isDefault && (
            <Badge size="sm" colorPalette="blue">
              {t("agentRow.default")}
            </Badge>
          )}
        </HStack>
      </Table.Cell>

      <Table.Cell>
        <Text textStyle="paragraph/S/regular" color="fg.muted" truncate>
          {binaryPath ?? "-"}
        </Text>
      </Table.Cell>

      <Table.Cell>
        <HStack gap="2xs" alignItems="center">
          {isInstalled ? (
            <>
              <Circle size={8} fill="var(--chakra-colors-fg-success)" stroke="none" />
              <Text textStyle="paragraph/S/regular" color="fg.success">
                {t("agentRow.installed")}
              </Text>
            </>
          ) : (
            <>
              <Circle size={8} fill="var(--chakra-colors-fg-muted)" stroke="none" />
              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {t("agentRow.disconnected")}
              </Text>
            </>
          )}
        </HStack>
      </Table.Cell>

      <Table.Cell>
        <HStack justify="flex-end">
          <Tooltip content={tooltipLabel}>
            <Box display="inline-flex">
              <Switch checked={isEnabled} onCheckedChange={onToggle} disabled={toggleDisabled} />
            </Box>
          </Tooltip>
        </HStack>
      </Table.Cell>

      <Table.Cell width="40px">
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton aria-label={t("agentRow.options")} variant="ghost" size="xs">
              <Icon as={MoreHorizontal} boxSize="16px" />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="160px" bg="bg">
              <MenuItem
                primaryLabel={t("agentRow.setAsDefault")}
                isDisabled={!isEnabled || isDefault}
                onClick={onSetDefault}
              />
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Table.Cell>
    </Table.Row>
  );
};
