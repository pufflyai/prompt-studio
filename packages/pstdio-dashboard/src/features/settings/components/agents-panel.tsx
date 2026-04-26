import { Box, Button, HStack, Spinner, Stack, Table, Text } from "@chakra-ui/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentConfig, AgentInfo } from "@/features/agents/types";
import { AddAgentManuallyDialog, SUPPORTED_AGENT_IDS, type SupportedAgentId } from "./add-agent-manually-dialog";
import { AgentRow } from "./agent-row";

type AgentRowModel = {
  id: string;
  name: string;
  isInstalled: boolean;
  config?: AgentConfig;
};

const readBinaryPath = (rawConfig: string) => {
  try {
    const parsed = JSON.parse(rawConfig) as { binary?: unknown };
    return typeof parsed.binary === "string" && parsed.binary.length > 0 ? parsed.binary : undefined;
  } catch {
    return undefined;
  }
};

const toAgentRows = (agents: AgentInfo[], configs: AgentConfig[]): AgentRowModel[] => {
  const configByAgentId = new Map(configs.map((config) => [config.agent_id, config]));
  const knownRows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    isInstalled: agent.availability.type === "INSTALLED",
    config: configByAgentId.get(agent.id),
  }));

  const knownAgentIds = new Set(agents.map((agent) => agent.id));
  const configuredOnlyRows = configs
    .filter((config) => !knownAgentIds.has(config.agent_id))
    .map((config) => ({
      id: config.agent_id,
      name: config.agent_id,
      isInstalled: false,
      config,
    }));

  return [...knownRows, ...configuredOnlyRows];
};

interface AgentsPanelProps {
  agents: AgentInfo[];
  configs: AgentConfig[];
  isLoading: boolean;
  isMutating: boolean;
  isAdding: boolean;
  onToggle: (agentId: string, isEnabled: boolean) => void;
  onSetDefault: (agentId: string) => void;
  onManualAdd: (agentId: SupportedAgentId, binary: string) => Promise<boolean>;
}

export const AgentsPanel = (props: AgentsPanelProps) => {
  const { t } = useTranslation("settings");
  const { agents, configs, isLoading, isMutating, isAdding, onToggle, onSetDefault, onManualAdd } = props;
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);

  const rows = toAgentRows(agents, configs);
  const existingAgentIds = configs.map((c) => c.agent_id);
  const allAgentsConnected = SUPPORTED_AGENT_IDS.every((id) => existingAgentIds.includes(id));

  return (
    <>
      <Stack gap="sm" padding="lg">
        <Stack gap="2xs">
          <HStack justify="space-between" alignItems="center">
            <Text textStyle="heading/S">{t("agentList.agents")}</Text>
            {!allAgentsConnected && (
              <Button size="xs" variant="subtle" onClick={() => setIsManualAddOpen(true)}>
                <Plus size={14} />
                {t("agentList.addAgentManually")}
              </Button>
            )}
          </HStack>
        </Stack>

        {isLoading ? (
          <Box py="md" display="flex" justifyContent="center">
            <Spinner size="sm" />
          </Box>
        ) : rows.length === 0 ? (
          <Text textStyle="paragraph/S/regular" color="foreground.secondary">
            {t("agentList.noAgentsFound")}
          </Text>
        ) : (
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>{t("agentRow.columnName")}</Table.ColumnHeader>
                <Table.ColumnHeader>{t("agentRow.columnExecutable")}</Table.ColumnHeader>
                <Table.ColumnHeader>{t("agentRow.columnStatus")}</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">{t("agentRow.columnEnabled")}</Table.ColumnHeader>
                <Table.ColumnHeader width="40px" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => {
                const config = row.config;
                const isEnabled = !!config;
                const isDefault = config?.is_default ?? false;

                return (
                  <AgentRow
                    key={row.id}
                    name={row.name}
                    isInstalled={row.isInstalled}
                    isEnabled={isEnabled}
                    isDefault={isDefault}
                    binaryPath={config ? readBinaryPath(config.config) : undefined}
                    isToggling={isMutating}
                    onToggle={() => onToggle(row.id, isEnabled)}
                    onSetDefault={() => onSetDefault(row.id)}
                  />
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Stack>

      <AddAgentManuallyDialog
        open={isManualAddOpen}
        isSubmitting={isAdding}
        existingAgentIds={existingAgentIds}
        onClose={() => setIsManualAddOpen(false)}
        onCreate={async (agentId, binary) => {
          const created = await onManualAdd(agentId, binary);
          if (created) {
            setIsManualAddOpen(false);
          }
        }}
      />
    </>
  );
};
