import { Button, Stack, Text } from "@chakra-ui/react";
import type { Settings, UpdateSettingsInput } from "@pstdio/sdk/api";
import { SettingsContentSkeleton, Switch } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
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
    {
      key: "notifications_enabled",
      label: t("betaFeatures.notifications"),
      description: t("betaFeatures.notificationsDescription"),
    },
    {
      key: "machine_tokens_enabled",
      label: t("betaFeatures.machineTokens"),
      description: t("betaFeatures.machineTokensDescription"),
    },
  ] as const;
  return (
    <Stack gap="md">
      {settings
        ? features.map((feature) => {
            const checked = settings[feature.key] === true;
            return (
              <Stack key={feature.key} gap="0">
                <ParamEditorRow
                  param={{
                    id: feature.key,
                    name: feature.label,
                    type: "property",
                    value: (
                      <Switch
                        checked={checked}
                        inputProps={{ checked, "aria-label": feature.label }}
                        disabled={saving}
                        onCheckedChange={({ checked }) => onChange({ [feature.key]: checked })}
                      />
                    ),
                  }}
                />
                <Text px="sm" color="fg.muted" textStyle="paragraph/S/regular">
                  {feature.description}
                </Text>
              </Stack>
            );
          })
        : null}
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
