import { Badge, Box, Button, Container, Flex, Stack, Text } from "@chakra-ui/react";
import { harnessLocalId } from "@pstdio/sdk/resources";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgents } from "@/features/agents/hooks/use-agents";
import type { AgentInfo } from "@/features/agents/types";
import { type CodingAgent, getStoredAgent, setOnboardingComplete, setStoredAgent } from "@/shared/agent-storage";

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

// Description copy exists for the first-party harnesses; others fall back to their name.
const HARNESS_DESCRIPTION_KEYS: Record<string, string> = {
  "claude-code": "onboarding.claudeCodeDescription",
  opencode: "onboarding.opencodeDescription",
};

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(getStoredAgent());
  const { data: agentInfoList = [], isLoading } = useAgents();

  const handleContinue = () => {
    if (!selectedAgent) {
      return;
    }

    setStoredAgent(selectedAgent);
    setOnboardingComplete();
    navigate({ to: "/projects" });
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

          {agentInfoList.map((agent) => {
            const isSelected = selectedAgent === agent.id;
            const badge = getAvailabilityBadge(agent, isLoading, t);
            const descriptionKey = HARNESS_DESCRIPTION_KEYS[harnessLocalId(agent.id)];

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
                    <Text textStyle="label/L/medium">{agent.name}</Text>
                    <Text textStyle="paragraph/S/regular" color="fg.muted">
                      {descriptionKey ? t(descriptionKey) : agent.name}
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

        <Flex justifyContent="flex-end">
          <Button variant="primary" size="sm" onClick={handleContinue} disabled={!selectedAgent}>
            {t("onboarding.continue")}
          </Button>
        </Flex>
      </Stack>
    </Container>
  );
};
