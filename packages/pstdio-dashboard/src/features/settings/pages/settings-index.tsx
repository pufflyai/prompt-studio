import { Stack } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useAgentConfigs,
  useDisableAgent,
  useEnableAgent,
  useSetDefaultAgent,
} from "@/features/agents/hooks/use-agent-configs";
import { useAgents } from "@/features/agents/hooks/use-agents";
import { GLOBAL_SETTINGS_WIDGET_ID } from "@/shared/shell/dashboard-shell-modes";
import { useUnifiedShell } from "@/shared/shell/unified-shell-host";
import type { SupportedAgentId } from "../components/add-agent-manually-dialog";
import { AgentsPanel } from "../components/agents-panel";
import { parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";

interface AgentsSettingsWidgetProps {
  agents: ReturnType<typeof useAgents>["data"];
  configs: ReturnType<typeof useAgentConfigs>["data"];
  isAdding: boolean;
  isLoading: boolean;
  isMutating: boolean;
  onManualAdd: (agentId: SupportedAgentId, binary: string) => Promise<boolean>;
  onSetDefault: (agentId: string) => void;
  onToggle: (agentId: string, isEnabled: boolean) => void;
}

const AgentsSettingsWidget = (props: AgentsSettingsWidgetProps) => {
  const { agents, configs, isAdding, isLoading, isMutating, onManualAdd, onSetDefault, onToggle } = props;

  return (
    <Stack flex="1" minH="0" overflow="auto">
      <AgentsPanel
        agents={agents ?? []}
        configs={configs ?? []}
        isLoading={isLoading}
        isMutating={isMutating}
        isAdding={isAdding}
        onToggle={onToggle}
        onSetDefault={onSetDefault}
        onManualAdd={onManualAdd}
      />
    </Stack>
  );
};

export const Settings = () => {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const { panel } = useSearch({ strict: false });
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();
  const { data: configs = [], isLoading: isLoadingConfigs } = useAgentConfigs();
  const enableAgent = useEnableAgent();
  const disableAgent = useDisableAgent();
  const setDefaultAgent = useSetDefaultAgent();
  const activePanel = parseSettingsPanel(panel);
  const settingsShell = useUnifiedShell();

  const isLoading = isLoadingAgents || isLoadingConfigs;
  const isMutating = enableAgent.isPending || disableAgent.isPending || setDefaultAgent.isPending;

  useEffect(() => {
    const subscription = settingsShell.breadcrumbs.setItems([{ title: t("agentList.title"), icon: "Settings" }]);
    return () => subscription.dispose();
  }, [settingsShell, t]);

  useEffect(() => {
    const nextPanel = toSettingsPanel(activePanel);
    if (panel === nextPanel) {
      return;
    }

    navigate({
      to: "/settings",
      search: { panel: nextPanel },
      replace: true,
    });
  }, [activePanel, navigate, panel]);

  const handleToggle = (agentId: string, isCurrentlyEnabled: boolean) => {
    if (isCurrentlyEnabled) {
      disableAgent.mutate(agentId, {
        onError: (error) => {
          toaster.create({ type: "error", title: t("agentList.failedToDisableAgent"), description: error.message });
        },
      });
    } else {
      enableAgent.mutate(
        { agentId },
        {
          onError: (error) => {
            toaster.create({ type: "error", title: t("agentList.failedToEnableAgent"), description: error.message });
          },
        },
      );
    }
  };

  const handleSetDefault = (agentId: string) => {
    setDefaultAgent.mutate(agentId, {
      onError: (error) => {
        toaster.create({ type: "error", title: t("agentList.failedToSetDefaultAgent"), description: error.message });
      },
    });
  };

  const handleManualAdd = async (agentId: SupportedAgentId, binary: string) => {
    try {
      await enableAgent.mutateAsync({ agentId, binary });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("agentList.failedToEnableAgent");
      toaster.create({ type: "error", title: t("agentList.failedToEnableAgent"), description: message });
      return false;
    }
  };

  useEffect(() => {
    const main = settingsShell.renderers.registerRenderer({
      id: GLOBAL_SETTINGS_WIDGET_ID,
      render: () => (
        <AgentsSettingsWidget
          agents={agents}
          configs={configs}
          isLoading={isLoading}
          isMutating={isMutating}
          isAdding={enableAgent.isPending}
          onToggle={handleToggle}
          onSetDefault={handleSetDefault}
          onManualAdd={handleManualAdd}
        />
      ),
    });

    return () => {
      main.dispose();
    };
  });

  return <ShellWorkbench shell={settingsShell} />;
};
