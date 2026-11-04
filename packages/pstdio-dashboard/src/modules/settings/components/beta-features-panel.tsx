import { Button, Stack, Text } from "@chakra-ui/react";
import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import { SettingsContentSkeleton } from "@pstdio/ui";
import { ParamEditor } from "@pstdio/ui/param-editor";
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
    <Stack gap="md">
      {settings ? (
        <ParamEditor
          fullWidth
          readOnly={saving}
          params={features.map((feature) => ({
            id: feature.key,
            name: feature.label,
            type: "boolean",
            defaultValue: settings[feature.key] === true,
          }))}
          onChange={(id, value) => onChange({ [id]: value === true })}
        />
      ) : null}
      {!settings && !error ? <SettingsContentSkeleton /> : null}
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
