import { Badge, Box, Button, Container, Flex, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type CodingAgent,
  getStoredAgent,
  setOnboardingComplete,
  setStoredAgent,
} from "@/features/agents/agent-storage";
import { useSetupAvailableAgents } from "@/features/agents/hooks/use-agent-availability";
import { useAgents } from "@/features/agents/hooks/use-agents";
import type { AgentInfo } from "@/features/agents/types";

type AvailabilityBadge = {
  label: string;
  colorPalette: "gray" | "green" | "red";
};

const getAvailabilityBadge = (
  agent: AgentInfo | undefined,
  isLoading: boolean,
  t: (key: string) => string,
): AvailabilityBadge => {
  if (isLoading) {
    return { label: t("onboarding.checkingAvailability"), colorPalette: "gray" };
  }

  if (agent?.availability.type === "INSTALLED") {
    return { label: t("onboarding.ready"), colorPalette: "green" };
  }

  return { label: t("onboarding.notDetected"), colorPalette: "red" };
};

const AGENTS: { id: CodingAgent; nameKey: string; descriptionKey: string }[] = [
  { id: "claude-code", nameKey: "onboarding.claudeCode", descriptionKey: "onboarding.claudeCodeDescription" },
  { id: "opencode", nameKey: "onboarding.opencode", descriptionKey: "onboarding.opencodeDescription" },
];

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(getStoredAgent());
  const [setupError, setSetupError] = useState<string | null>(null);
  const { data: agentInfoList, isLoading } = useAgents();
  const setupMutation = useSetupAvailableAgents();

  const findAgentInfo = (id: string) => agentInfoList?.find((a) => a.id === id);

  const handleContinue = async () => {
    if (!selectedAgent || setupMutation.isPending) {
      return;
    }

    setSetupError(null);

    try {
      await setupMutation.mutateAsync(selectedAgent);
      setStoredAgent(selectedAgent);
      setOnboardingComplete();
      navigate({ to: "/projects" });
    } catch {
      setSetupError(t("onboarding.setupError"));
    }
  };

  return (
    <Container>
      <Stack gap="lg" padding="lg">
        <Stack gap="2xs">
          <Text textStyle="heading/M">{t("onboarding.welcome")}</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("onboarding.pickAgent")}
          </Text>
        </Stack>

        <Stack gap="sm">
          <Stack gap="2xs">
            <Text textStyle="label/L/medium">{t("onboarding.chooseAgent")}</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {t("onboarding.updateLater")}
            </Text>
          </Stack>

          {AGENTS.map((agent) => {
            const isSelected = selectedAgent === agent.id;
            const badge = getAvailabilityBadge(findAgentInfo(agent.id), isLoading, t);

            return (
              <Box
                key={agent.id}
                as="button"
                onClick={() => setSelectedAgent(agent.id)}
                borderWidth="1px"
                borderRadius="lg"
                borderColor={isSelected ? "border.accent" : "border.muted"}
                bg={isSelected ? "bg.emphasized" : "bg"}
                px="lg"
                py="md"
                textAlign="left"
                transition="border-color 0.2s ease"
                _hover={{ borderColor: "border" }}
              >
                <Flex alignItems="flex-start" justifyContent="space-between" gap="md">
                  <Stack gap="xs" flex="1">
                    <Text textStyle="label/L/medium">{t(agent.nameKey)}</Text>
                    <Text textStyle="paragraph/S/regular" color="fg.muted">
                      {t(agent.descriptionKey)}
                    </Text>
                  </Stack>
                  <Badge colorPalette={badge.colorPalette} variant="subtle">
                    {badge.label}
                  </Badge>
                </Flex>
              </Box>
            );
          })}
        </Stack>

        {setupError ? (
          <Text textStyle="paragraph/S/regular" color="red.500">
            {setupError}
          </Text>
        ) : null}

        <Flex justifyContent="flex-end">
          <Button
            variant="primary"
            size="sm"
            onClick={handleContinue}
            disabled={!selectedAgent || setupMutation.isPending}
          >
            {setupMutation.isPending ? t("onboarding.settingUp") : t("onboarding.continue")}
          </Button>
        </Flex>
      </Stack>
    </Container>
  );
};
