import { Flex, Stack } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useAgentConfigs,
  useDisableAgent,
  useEnableAgent,
  useSetDefaultAgent,
} from "@/features/agents/hooks/use-agent-configs";
import { useAgents } from "@/features/agents/hooks/use-agents";
import type { SupportedAgentId } from "../components/add-agent-manually-dialog";
import { AgentsPanel } from "../components/agents-panel";
import { type GlobalSettingsSection, SettingsSidebar } from "../components/settings-sidebar";
import { parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";

export const Settings = () => {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const { panel } = useSearch({ strict: false });
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();
  const { data: configs = [], isLoading: isLoadingConfigs } = useAgentConfigs();
  const enableAgent = useEnableAgent();
  const disableAgent = useDisableAgent();
  const setDefaultAgent = useSetDefaultAgent();
  const [activeSection, setActiveSection] = useState<GlobalSettingsSection>(() => parseSettingsPanel(panel));

  const isLoading = isLoadingAgents || isLoadingConfigs;
  const isMutating = enableAgent.isPending || disableAgent.isPending || setDefaultAgent.isPending;

  useEffect(() => {
    setActiveSection(parseSettingsPanel(panel));
  }, [panel]);

  useEffect(() => {
    const nextPanel = toSettingsPanel(activeSection);
    if (panel === nextPanel) {
      return;
    }

    navigate({
      to: "/settings",
      search: { panel: nextPanel },
      replace: true,
    });
  }, [activeSection, navigate, panel]);

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

  return (
    <Flex height="100%" width="100%" minH="0">
      <SettingsSidebar activeSection={activeSection} onSelectSection={setActiveSection} />
      <Stack flex="1" minH="0" overflow="auto">
        <AgentsPanel
          agents={agents}
          configs={configs}
          isLoading={isLoading}
          isMutating={isMutating}
          isAdding={enableAgent.isPending}
          onToggle={handleToggle}
          onSetDefault={handleSetDefault}
          onManualAdd={handleManualAdd}
        />
      </Stack>
    </Flex>
  );
};
