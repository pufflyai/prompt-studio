import { Button, Stack, Text } from "@chakra-ui/react";
import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import { Switch } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import { useSettings, useUpdateSettings } from "../data/use-settings";

type BetaFeatureSettings = Pick<Settings, "notifications_enabled" | "machine_tokens_enabled">;

interface BetaFeaturesContentProps {
  settings?: BetaFeatureSettings;
  saving?: boolean;
  error?: string;
  onChange: (update: UpdateSettingsInput) => void;
  onRetry: () => void;
}

export const BetaFeaturesContent = (props: BetaFeaturesContentProps) => {
  const { settings, saving, error, onChange, onRetry } = props;
  const { t } = useTranslation("settings");
  const features = [
    { key: "notifications_enabled", label: t("betaFeatures.notifications") },
    { key: "machine_tokens_enabled", label: t("betaFeatures.machineTokens") },
  ] as const;
  return (
    <Stack gap="md" padding="lg">
      <Stack gap="2xs">
        <Text textStyle="heading/S">{t("betaFeatures.title")}</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("betaFeatures.description")}
        </Text>
      </Stack>
      {features.map((feature) => {
        const checked = settings?.[feature.key] === true;
        return (
          <Switch
            key={feature.key}
            checked={checked}
            // A failed save leaves `checked` unchanged, so the hidden input needs it too to flip back.
            inputProps={{ checked }}
            disabled={!settings || saving}
            onCheckedChange={(details) => onChange({ [feature.key]: details.checked })}
          >
            {feature.label}
          </Switch>
        );
      })}
      {!settings && !error ? <Text color="fg.muted">{t("betaFeatures.loading")}</Text> : null}
      {error ? (
        <Stack gap="sm" role="alert">
          <Text color="fg.error">{error}</Text>
          <Button variant="outline" alignSelf="start" onClick={onRetry}>
            {t("runtimeSettings.retry")}
          </Button>
        </Stack>
      ) : null}
    </Stack>
  );
};

export const BetaFeaturesPanel = () => {
  const { data, error, refetch } = useSettings();
  const update = useUpdateSettings();
  return (
    <BetaFeaturesContent
      settings={data}
      saving={update.isPending}
      error={(update.error ?? error)?.message}
      onChange={(input) => update.mutate(input)}
      onRetry={() => {
        update.reset();
        void refetch();
      }}
    />
  );
};
