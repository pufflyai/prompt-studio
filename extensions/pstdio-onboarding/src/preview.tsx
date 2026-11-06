import { Box, Text } from "@chakra-ui/react";
import { useState } from "react";
import { resolveExtensionChoices } from "./catalog";
import { Onboarding, OnboardingLoadError } from "./onboarding";
import { previewExtensions } from "./preview-inventory";
import { SetupProvider } from "./provider";
import { SetupLoading } from "./setup-loading";
import type { OnboardingInfo } from "./types";

export type { OnboardingInfo } from "./types";
export const OnboardingPreview = (props: {
  info: OnboardingInfo;
  harnessIcons: Parameters<typeof Onboarding>[0]["harnessIcons"];
  pending?: boolean;
  loadError?: boolean;
  loading?: boolean;
}) => {
  const [complete, setComplete] = useState(false);
  const [loadError, setLoadError] = useState(props.loadError);
  if (complete) return <Text>Workspace</Text>;
  return (
    <SetupProvider>
      <Box
        w="2xl"
        h="xl"
        maxW="100vw"
        maxH="100dvh"
        display="flex"
        flexDirection="column"
        bg="bg"
        borderRadius="md"
        borderWidth="1px"
      >
        {props.loading && <SetupLoading onSkip={() => setComplete(true)} />}
        {!props.loading && loadError && (
          <OnboardingLoadError
            error={new Error("Setup is unavailable")}
            onRetry={async () => setLoadError(false)}
            onSkip={() => setComplete(true)}
          />
        )}
        {!props.loading && !loadError && (
          <Onboarding
            info={props.info}
            harnessIcons={props.harnessIcons}
            extensionChoices={resolveExtensionChoices({ extensions: [], marketplace: previewExtensions })}
            update={async (request) => {
              if (props.pending) await new Promise(() => {});
              return {
                ...props.info.state,
                ...(request.step === "harnesses" ? { harnesses: request.harnesses } : {}),
                ...(request.step === "complete" ? { completed: true, workAreas: request.workAreas } : {}),
                ...(request.step === "skip" ? { completed: true } : {}),
              };
            }}
            onComplete={() => setComplete(true)}
          />
        )}
      </Box>
    </SetupProvider>
  );
};
