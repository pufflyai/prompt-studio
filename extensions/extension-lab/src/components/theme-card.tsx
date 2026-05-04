import { HStack, Stack, Text } from "@chakra-ui/react";
import { getThemePreferenceMode, Switch, useThemePreference } from "@pstdio/ui";
import { buildSetThemePreferenceMessage } from "../host-bridge";
import { LabCard } from "./lab-card";

export const ThemeCard = () => {
  const { themePreference, themePreferences, setThemePreference } = useThemePreference();
  const mode = getThemePreferenceMode(themePreference, themePreferences);
  const isDark = mode === "dark";

  const setMode = (checked: boolean) => {
    const nextMode = checked ? "dark" : "light";
    const nextPreference = themePreferences.find((preference) => preference.mode === nextMode)?.id ?? themePreference;

    setThemePreference(nextPreference);
    window.parent.postMessage(buildSetThemePreferenceMessage(nextPreference), window.location.origin);
  };

  return (
    <LabCard title="Theme" subtitle="Synchronized with the dashboard host.">
      <HStack justify="space-between" align="center">
        <Stack gap="2xs">
          <Text textStyle="label/S/medium">Current theme</Text>
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {themePreference}
          </Text>
        </Stack>
        <Switch checked={isDark} onCheckedChange={(event: { checked: boolean }) => setMode(event.checked)}>
          Dark
        </Switch>
      </HStack>
    </LabCard>
  );
};
