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
import { useAgentAvailability, useRunAgentSetup } from "@/features/agents/hooks/use-agent-availability";

type AvailabilityBadge = {
  label: string;
  colorPalette: "gray" | "green" | "orange" | "red";
};

const getAvailabilityBadge = (
  status: string | null,
  options: { isChecking: boolean; hasError: boolean },
  t: (key: string) => string,
): AvailabilityBadge => {
  if (options.isChecking) {
    return { label: t("onboarding.checkingAvailability"), colorPalette: "gray" };
  }

  if (options.hasError) {
    return { label: t("onboarding.unavailable"), colorPalette: "red" };
  }

  if (status === "INSTALLED") {
    return { label: t("onboarding.ready"), colorPalette: "green" };
  }

  return { label: t("onboarding.notDetected"), colorPalette: "red" };
};

export const Onboarding = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(getStoredAgent());
  const [setupError, setSetupError] = useState<string | null>(null);
  const { data: availability, isLoading: isChecking, isError: hasError } = useAgentAvailability("opencode");
  const setupMutation = useRunAgentSetup();
  const isOpencodeSelected = selectedAgent === "opencode";
  const availabilityBadge = getAvailabilityBadge(availability?.type ?? null, { isChecking, hasError }, t);

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

          <Box
            as="button"
            onClick={() => setSelectedAgent("opencode")}
            borderWidth="1px"
            borderRadius="lg"
            borderColor={isOpencodeSelected ? "border.accent" : "border.muted"}
            bg={isOpencodeSelected ? "bg.emphasized" : "bg"}
            px="lg"
            py="md"
            textAlign="left"
            transition="border-color 0.2s ease"
            _hover={{ borderColor: "border" }}
          >
            <Flex alignItems="flex-start" justifyContent="space-between" gap="md">
              <Stack gap="xs" flex="1">
                <Text textStyle="label/L/medium">{t("onboarding.opencode")}</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  {t("onboarding.opencodeDescription")}
                </Text>
              </Stack>
              <Badge colorPalette={availabilityBadge.colorPalette} variant="subtle">
                {availabilityBadge.label}
              </Badge>
            </Flex>
          </Box>
        </Stack>

        {setupError ? (
          <Text textStyle="paragraph/S/regular" color="red.500">
            {setupError}
          </Text>
        ) : null}

        <Flex justifyContent="flex-end">
          <Button
            variant="solid"
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
