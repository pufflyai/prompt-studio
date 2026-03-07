import { Badge, Box, Button, Container, Flex, Stack, Text } from "@chakra-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
): AvailabilityBadge => {
  if (options.isChecking) {
    return { label: "Checking availability...", colorPalette: "gray" };
  }

  if (options.hasError) {
    return { label: "Unavailable", colorPalette: "red" };
  }

  if (status === "INSTALLED") {
    return { label: "Ready", colorPalette: "green" };
  }

  return { label: "Not detected", colorPalette: "red" };
};

export const Onboarding = () => {
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(getStoredAgent());
  const [setupError, setSetupError] = useState<string | null>(null);
  const { data: availability, isLoading: isChecking, isError: hasError } = useAgentAvailability("opencode");
  const setupMutation = useRunAgentSetup();
  const isOpencodeSelected = selectedAgent === "opencode";
  const availabilityBadge = getAvailabilityBadge(availability?.type ?? null, { isChecking, hasError });

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
      setSetupError("Failed to run setup. Check your local agent install and try again.");
    }
  };

  return (
    <Container>
      <Stack gap="lg" padding="lg">
        <Stack gap="2xs">
          <Text textStyle="heading/M">Welcome to Prompt Studio</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Pick a coding agent to power new ticket attempts.
          </Text>
        </Stack>

        <Stack gap="sm">
          <Stack gap="2xs">
            <Text textStyle="label/L/medium">Choose a coding agent</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              You can update this choice later.
            </Text>
          </Stack>

          <Box
            as="button"
            onClick={() => setSelectedAgent("opencode")}
            borderWidth="1px"
            borderRadius="lg"
            borderColor={isOpencodeSelected ? "border.accent" : "border.secondary"}
            bg={isOpencodeSelected ? "bg.emphasized" : "bg"}
            px="lg"
            py="md"
            textAlign="left"
            transition="border-color 0.2s ease"
            _hover={{ borderColor: "border.primary" }}
          >
            <Flex alignItems="flex-start" justifyContent="space-between" gap="md">
              <Stack gap="xs" flex="1">
                <Text textStyle="label/L/medium">Opencode</Text>
                <Text textStyle="paragraph/S/regular" color="fg.muted">
                  Open-source, local-first coding agent for fast iteration.
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
            {setupMutation.isPending ? "Setting up..." : "Continue"}
          </Button>
        </Flex>
      </Stack>
    </Container>
  );
};
