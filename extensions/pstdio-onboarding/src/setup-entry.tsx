import { Stack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { resolveExtensionChoices, resolveHarnessIcons } from "./catalog";
import { createSetupView, type SetupClient } from "./create-view";
import { Onboarding, OnboardingLoadError } from "./onboarding";
import { SetupLoading } from "./setup-loading";

const Setup = ({ client }: { client: SetupClient }) => {
  const query = useQuery({ queryKey: ["setup"], queryFn: () => client.commands.read() });
  const close = () => {
    void client.placement.close();
  };
  let content = <SetupLoading onSkip={close} />;
  if (query.error)
    content = (
      <OnboardingLoadError
        error={query.error}
        onRetry={async () => {
          await query.refetch();
        }}
        onSkip={close}
      />
    );
  if (query.data)
    content = (
      <Onboarding
        info={query.data.info}
        harnessIcons={resolveHarnessIcons(query.data.inventory)}
        extensionChoices={resolveExtensionChoices(query.data.inventory)}
        update={(request) => client.commands.update({ request })}
        onComplete={close}
      />
    );
  return (
    <Stack h="full" minH="0" gap="0">
      {content}
    </Stack>
  );
};
export default createSetupView(Setup);
