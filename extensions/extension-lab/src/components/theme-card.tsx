import { HStack, Stack, Text } from "@chakra-ui/react";
import { Switch } from "@pstdio/ui";
import { useLabHost, useLabHostProps } from "../host-context";
import { LabCard } from "./lab-card";

export const ThemeCard = () => {
  const { host } = useLabHost();
  const { themePreference } = useLabHostProps();
  const current = themePreference ?? "pstdio-light";
  const isDark = /dark/i.test(current);

  const setMode = async (checked: boolean) => {
    const next = checked ? "pstdio-dark" : "pstdio-light";
    await host.call("setThemePreference", { themePreference: next });
  };

  return (
    <LabCard title="Theme" subtitle="Synchronized with the dashboard host.">
      <HStack justify="space-between" align="center">
        <Stack gap="2xs">
          <Text textStyle="label/S/medium">Current theme</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {current}
          </Text>
        </Stack>
        <Switch checked={isDark} onCheckedChange={(event: { checked: boolean }) => setMode(event.checked)}>
          Dark
        </Switch>
      </HStack>
    </LabCard>
  );
};
